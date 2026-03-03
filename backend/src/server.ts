import express from 'express';
import cors from 'cors';
import multer from 'multer';
import {
  initStorage, getFolders, createFolder, getFiles, uploadFile,
  getFileStream, deleteFile, moveFile, appendKbEntries, updateKbEntry, getKbMetadata,
  checkFilesExist, renameFile, renameFolder, deleteFolder, deleteAllFiles
} from './services/storage';
import type { KbEntry } from './services/storage';


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

initStorage();

const requireBucketName = process.env.GCS_BUCKET_NAME || 'kb-studio-bucket';

// GET /api/folders
app.get('/api/folders', async (req, res) => {
  try {
    const folders = await getFolders();
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/folders
app.post('/api/folders', async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'path is required' });
    await createFolder(path);
    res.json({ success: true, path });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files
app.get('/api/files', async (req, res) => {
  try {
    const { folderId, search } = req.query;
    let files = await getFiles(folderId as string);
    
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
  try {
    const { fileNames } = req.body;
    if (!fileNames || !Array.isArray(fileNames)) {
      return res.status(400).json({ error: 'fileNames array is required' });
    }
    const duplicates = await checkFilesExist(fileNames);
    res.json({ duplicates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files
app.post('/api/files', upload.array('files'), async (req, res) => {
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

      const filePath = await uploadFile(file, folderPath);

      const id = encodeURIComponent(filePath);
      kbEntries.push({
        id,
        structData: {
          title: file.originalname,
          description: '',
          date_valeur: '',
        },
        content: {
          mimeType: file.mimetype,
          uri: `gs://${requireBucketName}/${filePath}`,
        }
      });

      results.push({ id, name: file.originalname, path: filePath });
    }

    await appendKbEntries(kbEntries);
    res.json(results);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/files/:id
app.put('/api/files/:id', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf-8').normalize('NFC');
    const decodedFilePath = decodeURIComponent(id);
    const folderPath = decodedFilePath.substring(0, decodedFilePath.lastIndexOf('/')) || '';

    const filePath = await uploadFile(file, folderPath);

    res.json({ id, path: filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/files/:id
app.patch('/api/files/:id', async (req, res) => {
  try {
    const { description, date_valeur } = req.body;
    const id = req.params.id as string;
    
    const updated = await updateKbEntry(id, { description, date_valeur });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files/:id
app.delete('/api/files/:id', async (req, res) => {
  try {
    const id = req.params.id as string;
    const filePath = decodeURIComponent(id);
    await deleteFile(filePath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/:id/download
app.get('/api/files/:id/download', async (req, res) => {
  try {
    const id = req.params.id as string;
    const filePath = decodeURIComponent(id);
    const fileName = filePath.split('/').pop() || filePath;

    const { stream, getMetadata } = getFileStream(filePath);
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
  try {
    const id = req.params.id as string;
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'newName is required' });
    const filePath = decodeURIComponent(id);
    const newPath = await renameFile(filePath, newName);
    res.json({ success: true, newPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/files/:id/move
app.put('/api/files/:id/move', async (req, res) => {
  try {
    const id = req.params.id as string;
    const { newFolderId } = req.body;
    const filePath = decodeURIComponent(id);
    
    const newPath = await moveFile(filePath, newFolderId);
    res.json({ success: true, newPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/folders/:id
app.put('/api/folders/:id', async (req, res) => {
  try {
    const id = req.params.id as string;
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'newName is required' });
    const oldPath = decodeURIComponent(id);
    await renameFolder(oldPath, newName);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/folders/:id
app.delete('/api/folders/:id', async (req, res) => {
  try {
    const id = req.params.id as string;
    const folderPath = decodeURIComponent(id);
    await deleteFolder(folderPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files (delete all files)
app.delete('/api/files', async (req, res) => {
  try {
    await deleteAllFiles();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
