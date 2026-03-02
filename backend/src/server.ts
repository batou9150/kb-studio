import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { 
  initStorage, getFolders, createFolder, getFiles, uploadFile,
  getFileDownloadUrl, deleteFile, moveFile, appendKbEntry, updateKbEntry, getKbMetadata
} from './services/storage';
import { analyzeDocument } from './services/ai';

const app = express();
app.use(cors());
app.use(express.json());

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

// POST /api/files
app.post('/api/files', upload.array('files'), async (req, res) => {
  try {
    const folderPath = req.body.folderId || '';
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided' });

    const results = [];
    for (const file of files) {
      // 1. Upload to bucket
      const filePath = await uploadFile(file, folderPath);
      
      // 2. Analyze with Gemini
      const analysis = await analyzeDocument(file.buffer, file.originalname, file.mimetype);
      
      // 3. Update kb.ndjson
      const id = encodeURIComponent(filePath);
      const kbEntry = {
        id,
        structData: {
          title: file.originalname,
          description: analysis.description,
          date_valeur: analysis.date_valeur,
        },
        content: {
          mimeType: file.mimetype,
          uri: `gs://${requireBucketName}/${filePath}`,
        }
      };
      await appendKbEntry(kbEntry);
      
      results.push({ id, name: file.originalname, path: filePath, analysis });
    }
    
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
    
    const decodedFilePath = decodeURIComponent(id);
    const folderPath = decodedFilePath.substring(0, decodedFilePath.lastIndexOf('/')) || '';

    // Re-upload (overwrite)
    const filePath = await uploadFile(file, folderPath);
    
    // Re-analyze
    const analysis = await analyzeDocument(file.buffer, file.originalname, file.mimetype);
    
    // Update kb.ndjson
    await updateKbEntry(id, {
      description: analysis.description,
      date_valeur: analysis.date_valeur,
    });
    
    res.json({ id, path: filePath, analysis });
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
    const url = await getFileDownloadUrl(filePath);
    res.json({ url });
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
