import { Storage, File } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'kb-studio-bucket';
const bucket = storage.bucket(bucketName);
const kbJsonFile = 'kb.ndjson';

let lastReconcileTime = 0;
const RECONCILE_DEBOUNCE_MS = 5000;

/** Strip the gs://bucket/ prefix to get the GCS object path */
export const pathFromUri = (uri: string): string =>
  uri.replace(`gs://${bucketName}/`, '');

/** Look up a UUID in kb.ndjson and return the GCS file path */
export const resolveFilePath = async (id: string): Promise<string> => {
  const metadata = await getKbMetadata();
  const entry = metadata.find(m => m.id === id);
  if (!entry) throw new Error(`No kb.ndjson entry found for id ${id}`);
  return pathFromUri(entry.content.uri);
};

export interface KbEntry {
  id: string;
  structData: {
    title: string;
    description: string;
    value_date: string;
    category: string;
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

async function reconcileKbMetadata(): Promise<void> {
  const [kbExists] = await bucket.file(kbJsonFile).exists();
  const now = Date.now();
  if (kbExists && now - lastReconcileTime < RECONCILE_DEBOUNCE_MS) return;
  lastReconcileTime = now;

  const [allFiles] = await bucket.getFiles();
  const bucketPaths = new Set(
    allFiles
      .filter(f => !f.name.endsWith('/') && f.name !== kbJsonFile)
      .map(f => f.name)
  );

  const metadata = await getKbMetadata();
  const knownPaths = new Set(metadata.map(m => pathFromUri(m.content.uri)));

  // Detect orphan files (in bucket but not in kb.ndjson)
  const newEntries: KbEntry[] = [];
  for (const file of allFiles) {
    if (file.name.endsWith('/') || file.name === kbJsonFile) continue;
    if (knownPaths.has(file.name)) continue;

    const fileName = file.name.split('/').pop() || file.name;
    newEntries.push({
      id: uuidv4(),
      structData: {
        title: fileName,
        description: '',
        value_date: extractValueDate(fileName),
        category: '',
      },
      content: {
        mimeType: file.metadata.contentType || 'application/octet-stream',
        uri: `gs://${bucketName}/${file.name}`,
      },
    });
  }

  // Detect stale entries (in kb.ndjson but not in bucket)
  const filtered = metadata.filter(m => bucketPaths.has(pathFromUri(m.content.uri)));

  const hasNew = newEntries.length > 0;
  const hasStale = filtered.length < metadata.length;

  if (hasNew || hasStale) {
    await saveKbMetadata([...filtered, ...newEntries]);
  }
}

export const getFiles = async (folderId?: string): Promise<any[]> => {
  await reconcileKbMetadata();

  const options: any = {};
  if (folderId) {
    options.prefix = folderId.endsWith('/') ? folderId : folderId + '/';
  }
  
  const [files] = await bucket.getFiles(options);
  
  // Read kb.ndjson to merge metadata, keyed by GCS path
  const metadata = await getKbMetadata();
  const metaMap = new Map(metadata.map(m => [pathFromUri(m.content.uri), m]));

  return files
    .filter(file => !file.name.endsWith('/') && file.name !== kbJsonFile)
    .map(file => {
      const meta = metaMap.get(file.name);
      return {
        id: meta?.id ?? encodeURIComponent(file.name),
        name: file.name.split('/').pop() || file.name,
        path: file.name,
        size: file.metadata.size,
        contentType: file.metadata.contentType,
        updated: file.metadata.updated,
        metadata: meta || null
      };
    });
};

export const checkFilesExist = async (fileNames: string[]): Promise<{name: string, id: string}[]> => {
  const [allFiles] = await bucket.getFiles();
  const existingPaths = allFiles
    .filter(f => !f.name.endsWith('/') && f.name !== kbJsonFile);

  // Build a map: normalized file name → GCS path
  const nameToPath = new Map<string, string>();
  for (const f of existingPaths) {
    const baseName = f.name.split('/').pop()!.normalize('NFC');
    nameToPath.set(baseName, f.name);
  }

  // Read kb.ndjson to map path → UUID
  const metadata = await getKbMetadata();
  const pathToId = new Map(metadata.map(m => [pathFromUri(m.content.uri), m.id]));

  return fileNames
    .filter(name => nameToPath.has(name.normalize('NFC')))
    .map(name => {
      const gcsPath = nameToPath.get(name.normalize('NFC'))!;
      return { name, id: pathToId.get(gcsPath) ?? encodeURIComponent(gcsPath) };
    });
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
  // Remove kb.ndjson entry by matching path
  const metadata = await getKbMetadata();
  const filtered = metadata.filter(m => pathFromUri(m.content.uri) !== filePath);
  await saveKbMetadata(filtered);
};

export const renameFile = async (filePath: string, newName: string) => {
  const folderPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
  const newFilePath = folderPath + newName;

  await bucket.file(filePath).move(newFilePath);

  // Update kb.ndjson — find by path, keep UUID stable
  const metadata = await getKbMetadata();
  const entry = metadata.find(m => pathFromUri(m.content.uri) === filePath);
  if (entry) {
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

  // Update kb.ndjson — find by path, keep UUID stable
  const metadata = await getKbMetadata();
  const entry = metadata.find(m => pathFromUri(m.content.uri) === filePath);
  if (entry) {
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
    const lines = content.toString().trim().split(/\\n|\n/);
    return lines.filter(line => line.trim() !== '').map(line => JSON.parse(line));
  } catch (error) {
    console.error('Error reading kb.ndjson:', error);
    return [];
  }
};

const saveKbMetadata = async (metadata: KbEntry[]) => {
  const ndjson = metadata.map(entry => JSON.stringify(entry)).join("\n") + "\n";
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

  // Update kb.ndjson entries — match by path prefix, keep UUIDs stable
  const metadata = await getKbMetadata();
  let changed = false;
  for (const entry of metadata) {
    const entryPath = pathFromUri(entry.content.uri);
    if (entryPath.startsWith(oldPrefix)) {
      const newFilePath = newPrefix + entryPath.slice(oldPrefix.length);
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

  // Collect paths to remove from kb.ndjson
  const pathsToRemove = new Set<string>();
  for (const file of files) {
    if (!file.name.endsWith('/') && file.name !== kbJsonFile) {
      pathsToRemove.add(file.name);
    }
    await file.delete();
  }

  if (pathsToRemove.size > 0) {
    const metadata = await getKbMetadata();
    const filtered = metadata.filter(m => !pathsToRemove.has(pathFromUri(m.content.uri)));
    await saveKbMetadata(filtered);
  }
};

export function extractValueDate(filename: string): string {
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
