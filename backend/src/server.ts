import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  initStorage, getFolders, createFolder, getFiles, uploadFile,
  getFileStream, deleteFile, moveFile, appendKbEntries, updateKbEntry, getKbMetadata,
  checkFilesExist, renameFile, renameFolder, deleteFolder, deleteAllFiles,
  extractValueDate, resolveFilePath
} from './services/storage';
import type { KbEntry } from './services/storage';
import { analyzeFile, startBatchAnalysis, getBatchAnalysisStatus, listBatches, getBatchAnalysisDetails } from './services/gemini';
import {
  listDataStores as searchListDataStores,
  createDataStore as searchCreateDataStore,
  startImport as searchStartImport,
  getImportOperationStatus as searchGetImportOperationStatus,
  listImportOperations as searchListImportOperations,
  getDataStoreStatus as searchGetDataStoreStatus,
  purgeDocuments as searchPurgeDocuments,
  listDocuments as searchListDocuments,
  answerQuery as searchAnswerQuery,
  searchQuery as searchSearchQuery,
  deleteDataStore as searchDeleteDataStore,
} from './services/search';


const app = express();
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

const upload = multer({ storage: multer.memoryStorage() });

// Parse comma-separated bucket names
const bucketNames = (process.env.GCS_BUCKET_NAME || 'kb-studio-bucket')
  .split(',').map(s => s.trim()).filter(Boolean);
const allowedBuckets = new Set(bucketNames);

// Init storage for all buckets
for (const b of bucketNames) {
  initStorage(b);
}

function resolveBucket(req: Request, res: Response): string | null {
  const bucket = (req.query.bucket as string) || bucketNames[0];
  if (!allowedBuckets.has(bucket)) {
    res.status(400).json({ error: `Invalid bucket: ${bucket}` });
    return null;
  }
  return bucket;
}

// GET /api/config
app.get('/api/config', (_req, res) => {
  res.json({
    bucketName: bucketNames[0],
    bucketNames,
    projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
    appName: process.env.APP_NAME || 'KB-Studio',
    appLogo: process.env.APP_LOGO || '',
  });
});

// GET /api/folders
app.get('/api/folders', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const folders = await getFolders(bucket);
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/folders
app.post('/api/folders', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'path is required' });
    await createFolder(bucket, path);
    res.json({ success: true, path });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files
app.get('/api/files', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const { folderId, search } = req.query;
    let files = await getFiles(bucket, folderId as string);

    if (search) {
      files = files.filter(f => f.name.toLowerCase().includes((search as string).toLowerCase()));
    }
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/check-duplicates
app.post('/api/files/check-duplicates', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const { fileNames } = req.body;
    if (!fileNames || !Array.isArray(fileNames)) {
      return res.status(400).json({ error: 'fileNames array is required' });
    }
    const duplicates = await checkFilesExist(bucket, fileNames);
    res.json({ duplicates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files
app.post('/api/files', upload.array('files'), async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const baseFolderPath = req.body.folderId || '';
    const files = req.files as Express.Multer.File[];
    const relativePaths: string[] = JSON.parse(req.body.relativePaths || '[]');

    if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided' });

    const results = [];
    const kbEntries: KbEntry[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf-8').normalize('NFC');

      // Compute per-file folder: base folder + relative path from dropped/selected folder
      const relDir = (relativePaths[i] || '').normalize('NFC');
      let folderPath = baseFolderPath;
      if (relDir) {
        folderPath = baseFolderPath
          ? `${baseFolderPath.endsWith('/') ? baseFolderPath : baseFolderPath + '/'}${relDir}`
          : relDir;
      }

      const filePath = await uploadFile(bucket, file, folderPath);

      const id = uuidv4();
      kbEntries.push({
        id,
        structData: {
          title: file.originalname,
          description: '',
          value_date: extractValueDate(file.originalname),
          category: '',
          folder: folderPath.replace(/\/+$/, ''),
        },
        content: {
          mimeType: file.mimetype,
          uri: `gs://${bucket}/${filePath}`,
        }
      });

      results.push({ id, name: file.originalname, path: filePath });
    }

    await appendKbEntries(bucket, kbEntries);
    res.json(results);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/files/:id
app.put('/api/files/:id', upload.single('file'), async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf-8').normalize('NFC');
    const resolvedPath = await resolveFilePath(bucket, id);
    const folderPath = resolvedPath.substring(0, resolvedPath.lastIndexOf('/')) || '';

    const filePath = await uploadFile(bucket, file, folderPath);

    res.json({ id, path: filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/files/:id
app.patch('/api/files/:id', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const { description, value_date, category } = req.body;
    const id = req.params.id as string;

    const updated = await updateKbEntry(bucket, id, { description, value_date, category });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files/:id
app.delete('/api/files/:id', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const filePath = await resolveFilePath(bucket, id);
    await deleteFile(bucket, filePath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/:id/preview
app.get('/api/files/:id/preview', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const filePath = await resolveFilePath(bucket, id);
    const fileName = filePath.split('/').pop() || filePath;

    const { stream, getMetadata } = getFileStream(bucket, filePath);
    const [metadata] = await getMetadata();

    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    if (metadata.size) {
      res.setHeader('Content-Length', metadata.size);
    }

    stream.pipe(res);
    stream.on('error', (err: any) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/:id/download
app.get('/api/files/:id/download', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const filePath = await resolveFilePath(bucket, id);
    const fileName = filePath.split('/').pop() || filePath;

    const { stream, getMetadata } = getFileStream(bucket, filePath);
    const [metadata] = await getMetadata();

    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    if (metadata.size) {
      res.setHeader('Content-Length', metadata.size);
    }

    stream.pipe(res);
    stream.on('error', (err: any) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/files/:id/rename
app.put('/api/files/:id/rename', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'newName is required' });
    const filePath = await resolveFilePath(bucket, id);
    const newPath = await renameFile(bucket, filePath, newName);
    res.json({ success: true, newPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/files/:id/move
app.put('/api/files/:id/move', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const { newFolderId } = req.body;
    const filePath = await resolveFilePath(bucket, id);

    const newPath = await moveFile(bucket, filePath, newFolderId);
    res.json({ success: true, newPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/folders/:id
app.put('/api/folders/:id', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'newName is required' });
    const oldPath = decodeURIComponent(id);
    await renameFolder(bucket, oldPath, newName);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/folders/:id
app.delete('/api/folders/:id', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const folderPath = decodeURIComponent(id);
    await deleteFolder(bucket, folderPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files (delete all files)
app.delete('/api/files', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    await deleteAllFiles(bucket);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Gemini analysis routes ---

// POST /api/files/analyze-all — Start batch analysis (must be before :id route)
app.post('/api/files/analyze-all', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const result = await startBatchAnalysis(bucket);
    res.json(result);
  } catch (err: any) {
    console.error('Batch analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/analyze-all/history — List past batches
app.get('/api/files/analyze-all/history', async (req, res) => {
  try {
    const batches = await listBatches();
    res.json(batches);
  } catch (err: any) {
    console.error('List batches error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/analyze-all/:batchName/details — Get batch details (read-only)
app.get('/api/files/analyze-all/:batchName/details', async (req, res) => {
  try {
    const batchName = req.params.batchName as string;
    const result = await getBatchAnalysisDetails(batchName);
    res.json(result);
  } catch (err: any) {
    console.error('Batch details error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/analyze-all/status — Poll batch status
app.get('/api/files/analyze-all/status', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const batchName = req.query.batchName as string;
    if (!batchName) return res.status(400).json({ error: 'batchName query parameter is required' });

    const result = await getBatchAnalysisStatus(bucket, batchName);
    res.json(result);
  } catch (err: any) {
    console.error('Batch status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/:id/analyze — Single file analysis
app.post('/api/files/:id/analyze', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const id = req.params.id as string;
    const metadata = await getKbMetadata(bucket);
    const entry = metadata.find(m => m.id === id);
    if (!entry) return res.status(404).json({ error: 'File not found in kb.ndjson' });

    const result = await analyzeFile(bucket, entry);
    await updateKbEntry(bucket, id, result);
    res.json(result);
  } catch (err: any) {
    console.error('Analyze file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Search / Datastore routes ---

// GET /api/search/datastores — List datastores across all locations
app.get('/api/search/datastores', async (req, res) => {
  try {
    const result = await searchListDataStores();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/search/datastores — Create datastore
app.post('/api/search/datastores', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const { dataStoreId, displayName, location = 'global', documentProcessingConfig, appConfig } = req.body;
    if (!dataStoreId || !displayName) return res.status(400).json({ error: 'dataStoreId and displayName are required' });
    const result = await searchCreateDataStore(bucket, dataStoreId, displayName, location, documentProcessingConfig, appConfig);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/search/datastores/:id/import — Start async import
app.post('/api/search/datastores/:id/import', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const dataStoreId = req.params.id as string;
    const { location = 'global', mode = 'INCREMENTAL' } = req.body;
    const result = await searchStartImport(bucket, dataStoreId, location, mode);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/operations/status — Poll import operation progress
app.get('/api/search/operations/status', async (req, res) => {
  try {
    const name = req.query.name as string;
    const location = (req.query.location as string) || 'global';
    if (!name) return res.status(400).json({ error: 'name query parameter is required' });
    const result = await searchGetImportOperationStatus(name, location);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/datastores/:id/imports — List import operation history
app.get('/api/search/datastores/:id/imports', async (req, res) => {
  try {
    const dataStoreId = req.params.id as string;
    const location = (req.query.location as string) || 'global';
    const result = await searchListImportOperations(dataStoreId, location);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/datastores/:id/status — Get status
app.get('/api/search/datastores/:id/status', async (req, res) => {
  const bucket = resolveBucket(req, res);
  if (!bucket) return;
  try {
    const dataStoreId = req.params.id as string;
    const location = (req.query.location as string) || 'global';
    const status = await searchGetDataStoreStatus(bucket, dataStoreId, location);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/search/datastores/:id/documents — Purge all documents
app.delete('/api/search/datastores/:id/documents', async (req, res) => {
  try {
    const dataStoreId = req.params.id as string;
    const location = (req.query.location as string) || 'global';
    const result = await searchPurgeDocuments(dataStoreId, location);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/datastores/:id/documents — List documents
app.get('/api/search/datastores/:id/documents', async (req, res) => {
  try {
    const dataStoreId = req.params.id as string;
    const location = (req.query.location as string) || 'global';
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const pageToken = (req.query.pageToken as string) || undefined;
    const result = await searchListDocuments(dataStoreId, location, pageSize, pageToken);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/search/datastores/:id — Delete engine + datastore
app.delete('/api/search/datastores/:id', async (req, res) => {
  try {
    const dataStoreId = req.params.id as string;
    const location = (req.query.location as string) || 'global';
    await searchDeleteDataStore(dataStoreId, location);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/search/datastores/:id/search — Search query (no engine required)
app.post('/api/search/datastores/:id/search', async (req, res) => {
  try {
    const dataStoreId = req.params.id as string;
    const { location = 'global', query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const result = await searchSearchQuery(dataStoreId, location, query);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/search/datastores/:id/answer — Answer query using serving config
app.post('/api/search/datastores/:id/answer', async (req, res) => {
  try {
    const dataStoreId = req.params.id as string;
    const { location = 'global', query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const result = await searchAnswerQuery(dataStoreId, location, query);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend static files (production: built frontend copied to ../public)
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback: serve index.html for all non-API routes
app.get('*splat', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
