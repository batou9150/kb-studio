import { Storage, File } from '@google-cloud/storage';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'kb-studio-bucket';
const bucket = storage.bucket(bucketName);
const kbJsonFile = 'kb.ndjson';

export interface KbEntry {
  id: string;
  structData: {
    title: string;
    description: string;
    date_valeur: string;
  };
  content: {
    mimeType: string;
    uri: string;
  };
}

// Ensure the bucket exists (for local testing mostly)
export const initStorage = async () => {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log(`Bucket ${bucketName} does not exist. Please create it or set GCS_BUCKET_NAME.`);
    }
  } catch (error) {
    console.error('Error connecting to GCS:', error);
  }
};

export const getFolders = async (): Promise<string[]> => {
  const [files] = await bucket.getFiles({ autoPaginate: false });
  const folders = new Set<string>();
  
  files.forEach(file => {
    const parts = file.name.split('/');
    if (parts.length > 1) {
      let currentFolder = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentFolder += (i === 0 ? '' : '/') + parts[i];
        folders.add(currentFolder);
      }
    }
  });

  return Array.from(folders).sort();
};

export const createFolder = async (folderPath: string) => {
  const file = bucket.file(`${folderPath.endsWith('/') ? folderPath : folderPath + '/'}`);
  await file.save('');
  return { success: true };
};

export const getFiles = async (folderId?: string): Promise<any[]> => {
  const options: any = {};
  if (folderId) {
    options.prefix = folderId.endsWith('/') ? folderId : folderId + '/';
  }
  
  const [files] = await bucket.getFiles(options);
  
  // Read kb.ndjson to merge metadata
  const metadata = await getKbMetadata();
  const metaMap = new Map(metadata.map(m => [m.id, m]));

  return files
    .filter(file => !file.name.endsWith('/') && file.name !== kbJsonFile)
    .map(file => {
      const id = encodeURIComponent(file.name);
      return {
        id,
        name: file.name.split('/').pop() || file.name,
        path: file.name,
        size: file.metadata.size,
        contentType: file.metadata.contentType,
        updated: file.metadata.updated,
        metadata: metaMap.get(id) || null
      };
    });
};

export const uploadFile = async (file: Express.Multer.File, folderPath: string): Promise<string> => {
  const destinationPath = folderPath ? `${folderPath.endsWith('/') ? folderPath : folderPath + '/'}${file.originalname}` : file.originalname;
  const gcsFile = bucket.file(destinationPath);
  
  await gcsFile.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
  });
  return destinationPath;
};

export const getFileDownloadUrl = async (filePath: string): Promise<string> => {
  const file = bucket.file(filePath);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });
  return url;
};

export const deleteFile = async (filePath: string) => {
  await bucket.file(filePath).delete();
  await removeKbEntry(encodeURIComponent(filePath));
};

export const moveFile = async (filePath: string, newFolderPath: string) => {
  const fileName = filePath.split('/').pop() || filePath;
  const newFilePath = newFolderPath ? `${newFolderPath.endsWith('/') ? newFolderPath : newFolderPath + '/'}${fileName}` : fileName;
  
  await bucket.file(filePath).move(newFilePath);
  
  // Update kb.ndjson
  const metadata = await getKbMetadata();
  const entryIndex = metadata.findIndex(m => m.id === encodeURIComponent(filePath));
  if (entryIndex > -1) {
    const entry = metadata[entryIndex];
    entry.id = encodeURIComponent(newFilePath);
    entry.content.uri = `gs://${bucketName}/${newFilePath}`;
    await saveKbMetadata(metadata);
  }
  return newFilePath;
};

// KB JSON Management
export const getKbMetadata = async (): Promise<KbEntry[]> => {
  try {
    const [exists] = await bucket.file(kbJsonFile).exists();
    if (!exists) return [];
    
    const [content] = await bucket.file(kbJsonFile).download();
    const lines = content.toString().trim().split("\\n");
    return lines.filter(line => line.trim() !== '').map(line => JSON.parse(line));
  } catch (error) {
    console.error('Error reading kb.ndjson:', error);
    return [];
  }
};

const saveKbMetadata = async (metadata: KbEntry[]) => {
  const ndjson = metadata.map(entry => JSON.stringify(entry)).join("\\n") + "\\n";
  await bucket.file(kbJsonFile).save(ndjson, {
    metadata: { contentType: 'application/x-ndjson' }
  });
};

export const appendKbEntry = async (entry: KbEntry) => {
  const metadata = await getKbMetadata();
  // check if exists
  const existingIdx = metadata.findIndex(m => m.id === entry.id);
  if (existingIdx > -1) {
    metadata[existingIdx] = entry;
  } else {
    metadata.push(entry);
  }
  await saveKbMetadata(metadata);
};

export const removeKbEntry = async (id: string) => {
  const metadata = await getKbMetadata();
  const filtered = metadata.filter(m => m.id !== id);
  await saveKbMetadata(filtered);
};

export const updateKbEntry = async (id: string, updates: Partial<KbEntry['structData']>) => {
  const metadata = await getKbMetadata();
  const entry = metadata.find(m => m.id === id);
  if (entry) {
    entry.structData = { ...entry.structData, ...updates };
    await saveKbMetadata(metadata);
  }
  return entry;
};
