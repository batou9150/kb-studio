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
  const [files] = await bucket.getFiles();
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

export const checkFilesExist = async (fileNames: string[]): Promise<string[]> => {
  const [allFiles] = await bucket.getFiles();
  const existingNames = new Set(
    allFiles
      .filter(f => !f.name.endsWith('/') && f.name !== kbJsonFile)
      .map(f => f.name.split('/').pop()!.normalize('NFC'))
  );
  return fileNames.filter(name => existingNames.has(name.normalize('NFC')));
};

export const uploadFile = async (file: Express.Multer.File, folderPath: string): Promise<string> => {
  const destinationPath = folderPath ? `${folderPath.endsWith('/') ? folderPath : folderPath + '/'}${file.originalname}` : file.originalname;
  const gcsFile = bucket.file(destinationPath);
  
  await gcsFile.save(file.buffer, {
    resumable: false,
    metadata: {
      contentType: file.mimetype,
    },
  });
  return destinationPath;
};

export const getFileStream = (filePath: string) => {
  const file = bucket.file(filePath);
  return {
    stream: file.createReadStream(),
    metadata: file.metadata,
    getMetadata: () => file.getMetadata(),
  };
};

export const deleteFile = async (filePath: string) => {
  await bucket.file(filePath).delete();
  await removeKbEntry(encodeURIComponent(filePath));
};

export const renameFile = async (filePath: string, newName: string) => {
  const folderPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
  const newFilePath = folderPath + newName;

  await bucket.file(filePath).move(newFilePath);

  // Update kb.ndjson
  const metadata = await getKbMetadata();
  const entry = metadata.find(m => m.id === encodeURIComponent(filePath));
  if (entry) {
    entry.id = encodeURIComponent(newFilePath);
    entry.content.uri = `gs://${bucketName}/${newFilePath}`;
    entry.structData.title = newName;
    await saveKbMetadata(metadata);
  }
  return newFilePath;
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
  await appendKbEntries([entry]);
};

export const appendKbEntries = async (entries: KbEntry[]) => {
  const metadata = await getKbMetadata();
  for (const entry of entries) {
    const existingIdx = metadata.findIndex(m => m.id === entry.id);
    if (existingIdx > -1) {
      metadata[existingIdx] = entry;
    } else {
      metadata.push(entry);
    }
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

export const renameFolder = async (oldPath: string, newPath: string) => {
  const oldPrefix = oldPath.endsWith('/') ? oldPath : oldPath + '/';
  const newPrefix = newPath.endsWith('/') ? newPath : newPath + '/';

  const [files] = await bucket.getFiles({ prefix: oldPrefix });

  for (const file of files) {
    const newName = newPrefix + file.name.slice(oldPrefix.length);
    await file.move(newName);
  }

  // Update kb.ndjson entries
  const metadata = await getKbMetadata();
  let changed = false;
  for (const entry of metadata) {
    const decodedId = decodeURIComponent(entry.id);
    if (decodedId.startsWith(oldPrefix)) {
      const newFilePath = newPrefix + decodedId.slice(oldPrefix.length);
      entry.id = encodeURIComponent(newFilePath);
      entry.content.uri = `gs://${bucketName}/${newFilePath}`;
      changed = true;
    }
  }
  if (changed) {
    await saveKbMetadata(metadata);
  }
};

export const deleteFolder = async (folderPath: string) => {
  const prefix = folderPath.endsWith('/') ? folderPath : folderPath + '/';
  const [files] = await bucket.getFiles({ prefix });

  // Collect IDs to remove from kb.ndjson
  const idsToRemove: string[] = [];
  for (const file of files) {
    if (!file.name.endsWith('/') && file.name !== kbJsonFile) {
      idsToRemove.push(encodeURIComponent(file.name));
    }
    await file.delete();
  }

  if (idsToRemove.length > 0) {
    const metadata = await getKbMetadata();
    const removeSet = new Set(idsToRemove);
    const filtered = metadata.filter(m => !removeSet.has(m.id));
    await saveKbMetadata(filtered);
  }
};

export function extractDateValeur(filename: string): string {
  // Strip extension
  const name = filename.replace(/\.[^.]+$/, '');

  const sep = `[_\\-.\\s/]`;
  const YYYY = `((?:19|20)\\d{2})`;
  const MM = `(0?[1-9]|1[0-2])`;
  const DD = `(0?[1-9]|[12]\\d|3[01])`;

  const pad = (s: string) => s.padStart(2, '0');

  // 1. YYYY sep MM sep DD
  let m = name.match(new RegExp(`(?<!\\d)${YYYY}${sep}${MM}${sep}${DD}(?!\\d)`));
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  // 2. DD sep MM sep YYYY
  m = name.match(new RegExp(`(?<!\\d)${DD}${sep}${MM}${sep}${YYYY}(?!\\d)`));
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;

  // 3. MM sep YYYY
  m = name.match(new RegExp(`(?<!\\d)${MM}${sep}${YYYY}(?!\\d)`));
  if (m) return `${m[2]}-${pad(m[1])}-01`;

  // 4. YYYY sep MM
  m = name.match(new RegExp(`(?<!\\d)${YYYY}${sep}${MM}(?!\\d)`));
  if (m) return `${m[1]}-${pad(m[2])}-01`;

  // 5. YYYY alone
  m = name.match(new RegExp(`(?<!\\d)${YYYY}(?!\\d)`));
  if (m) return `${m[1]}-01-01`;

  return '';
}

export const deleteAllFiles = async () => {
  const [files] = await bucket.getFiles();

  for (const file of files) {
    // Keep kb.ndjson file itself but we'll clear it after
    if (file.name === kbJsonFile) continue;
    await file.delete();
  }

  // Clear kb.ndjson
  await saveKbMetadata([]);
};
