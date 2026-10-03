import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { googleClientOptions } from '../credentials';
import { badRequest, conflict, notFound } from '../errors';

const storage = new Storage(googleClientOptions);
const kbJsonFile = 'kb.ndjson';

const getBucket = (name: string) => storage.bucket(name);

const lastReconcileTimes = new Map<string, number>();
const RECONCILE_DEBOUNCE_MS = 5000;
const KB_WRITE_MAX_ATTEMPTS = 5;

/** Strip the gs://any-bucket/ prefix to get the GCS object path */
export const pathFromUri = (uri: string): string =>
  uri.replace(/^gs:\/\/[^/]+\//, '');

/** Look up a UUID in kb.ndjson and return the GCS file path */
export const resolveFilePath = async (bucketName: string, id: string): Promise<string> => {
  const metadata = await getKbMetadata(bucketName);
  const entry = metadata.find(m => m.id === id);
  if (!entry) throw notFound(`No kb.ndjson entry found for id ${id}`);
  return pathFromUri(entry.content.uri);
};

export interface KbEntry {
  id: string;
  structData: {
    title: string;
    description: string;
    value_date: string;
    category: string;
    folder: string;
  };
  content: {
    mimeType: string;
    uri: string;
  };
}

// --- Path helpers & validation ---

/** Validate a single file or folder name (no separators, no dot segments, no control chars). */
export const validateName = (name: unknown, label = 'name'): string => {
  if (typeof name !== 'string' || name.trim() === '') throw badRequest(`${label} is required`);
  if (name.includes('/')) throw badRequest(`${label} must not contain "/"`);
  if (name === '.' || name === '..') throw badRequest(`${label} must not be "." or ".."`);
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(name)) throw badRequest(`${label} must not contain control characters`);
  if (Buffer.byteLength(name, 'utf-8') > 255) throw badRequest(`${label} is too long`);
  return name;
};

/** Normalize a folder path ("a/b/", "/a/b" → "a/b") and validate each segment. "" is the root. */
export const normalizeFolderPath = (folderPath: unknown): string => {
  if (folderPath === undefined || folderPath === null) return '';
  if (typeof folderPath !== 'string') throw badRequest('folder path must be a string');
  const trimmed = folderPath.replace(/^\/+|\/+$/g, '');
  if (trimmed === '') return '';
  return trimmed.split('/').map(segment => validateName(segment, 'folder name')).join('/');
};

const joinPath = (folderPath: string, fileName: string) =>
  folderPath ? `${folderPath}/${fileName}` : fileName;

const dirName = (filePath: string) =>
  filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';

const assertNotReserved = (filePath: string) => {
  if (filePath === kbJsonFile) throw badRequest(`${kbJsonFile} is a reserved file name`);
};

const assertFileAbsent = async (bucketName: string, filePath: string) => {
  const [exists] = await getBucket(bucketName).file(filePath).exists();
  if (exists) throw conflict(`A file already exists at ${filePath}`);
};

// Ensure the bucket exists (for local testing mostly)
export const initStorage = async (bucketName: string) => {
  try {
    const bucket = getBucket(bucketName);
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log(`Bucket ${bucketName} does not exist. Please create it or set GCS_BUCKET_NAME.`);
    }
  } catch (error) {
    console.error('Error connecting to GCS:', error);
  }
};

export const getFolders = async (bucketName: string): Promise<string[]> => {
  const bucket = getBucket(bucketName);
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

export const createFolder = async (bucketName: string, folderPath: string) => {
  const normalized = normalizeFolderPath(folderPath);
  if (!normalized) throw badRequest('path is required');
  const bucket = getBucket(bucketName);
  await bucket.file(`${normalized}/`).save('');
  return { success: true };
};

async function reconcileKbMetadata(bucketName: string): Promise<void> {
  const bucket = getBucket(bucketName);
  const [kbExists] = await bucket.file(kbJsonFile).exists();
  const now = Date.now();
  const lastReconcileTime = lastReconcileTimes.get(bucketName) || 0;
  if (kbExists && now - lastReconcileTime < RECONCILE_DEBOUNCE_MS) return;
  lastReconcileTimes.set(bucketName, now);

  const [allFiles] = await bucket.getFiles();
  const dataFiles = allFiles.filter(f => !f.name.endsWith('/') && f.name !== kbJsonFile);
  const bucketPaths = new Set(dataFiles.map(f => f.name));

  await mutateKbMetadata(bucketName, metadata => {
    const knownPaths = new Set(metadata.map(m => pathFromUri(m.content.uri)));

    // Detect orphan files (in bucket but not in kb.ndjson)
    const newEntries: KbEntry[] = dataFiles
      .filter(file => !knownPaths.has(file.name))
      .map(file => {
        const fileName = file.name.split('/').pop() || file.name;
        return {
          id: randomUUID(),
          structData: {
            title: fileName,
            description: '',
            value_date: extractValueDate(fileName),
            category: '',
            folder: dirName(file.name),
          },
          content: {
            mimeType: file.metadata.contentType || 'application/octet-stream',
            uri: `gs://${bucketName}/${file.name}`,
          },
        };
      });

    // Detect stale entries (in kb.ndjson but not in bucket)
    const filtered = metadata.filter(m => bucketPaths.has(pathFromUri(m.content.uri)));

    if (newEntries.length === 0 && filtered.length === metadata.length) return null;
    return [...filtered, ...newEntries];
  });
}

export const getFiles = async (bucketName: string, folderId?: string): Promise<any[]> => {
  await reconcileKbMetadata(bucketName);

  const bucket = getBucket(bucketName);
  const options: any = {};
  if (folderId) {
    options.prefix = folderId.endsWith('/') ? folderId : folderId + '/';
  }

  const [files] = await bucket.getFiles(options);

  // Read kb.ndjson to merge metadata, keyed by GCS path
  const metadata = await getKbMetadata(bucketName);
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

export const checkFilesExist = async (bucketName: string, fileNames: string[]): Promise<{name: string, id: string}[]> => {
  const bucket = getBucket(bucketName);
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
  const metadata = await getKbMetadata(bucketName);
  const pathToId = new Map(metadata.map(m => [pathFromUri(m.content.uri), m.id]));

  return fileNames
    .filter(name => nameToPath.has(name.normalize('NFC')))
    .map(name => {
      const gcsPath = nameToPath.get(name.normalize('NFC'))!;
      return { name, id: pathToId.get(gcsPath) ?? encodeURIComponent(gcsPath) };
    });
};

/** Upload a file into a folder (overwriting any object at the same path) and return its path. */
export const uploadFile = async (bucketName: string, file: Express.Multer.File, folderPath: string): Promise<string> => {
  const destinationPath = joinPath(normalizeFolderPath(folderPath), validateName(file.originalname, 'file name'));
  assertNotReserved(destinationPath);
  const bucket = getBucket(bucketName);
  const gcsFile = bucket.file(destinationPath);

  await gcsFile.save(file.buffer, {
    resumable: false,
    metadata: {
      contentType: file.mimetype,
    },
  });
  return destinationPath;
};

/**
 * Replace the content of the file identified by `id`, keeping its UUID and folder.
 * When the new file has a different name, the old object is removed and the entry
 * is renamed, so the knowledge base never ends up with both copies.
 */
export const replaceFile = async (bucketName: string, id: string, file: Express.Multer.File): Promise<string> => {
  const oldPath = await resolveFilePath(bucketName, id);
  const newPath = joinPath(dirName(oldPath), validateName(file.originalname, 'file name'));
  assertNotReserved(newPath);
  if (newPath !== oldPath) await assertFileAbsent(bucketName, newPath);

  await uploadFile(bucketName, file, dirName(oldPath));
  if (newPath !== oldPath) {
    await getBucket(bucketName).file(oldPath).delete({ ignoreNotFound: true });
  }

  await mutateKbMetadata(bucketName, metadata => {
    const entry = metadata.find(m => m.id === id);
    if (!entry) return null;
    entry.content.uri = `gs://${bucketName}/${newPath}`;
    entry.content.mimeType = file.mimetype;
    entry.structData.title = file.originalname;
    return metadata;
  });
  return newPath;
};

export const getFileStream = (bucketName: string, filePath: string) => {
  const bucket = getBucket(bucketName);
  const file = bucket.file(filePath);
  return {
    stream: file.createReadStream(),
    metadata: file.metadata,
    getMetadata: () => file.getMetadata(),
  };
};

export const deleteFile = async (bucketName: string, filePath: string) => {
  const bucket = getBucket(bucketName);
  await bucket.file(filePath).delete({ ignoreNotFound: true });
  // Remove kb.ndjson entry by matching path
  await mutateKbMetadata(bucketName, metadata =>
    metadata.filter(m => pathFromUri(m.content.uri) !== filePath));
};

export const renameFile = async (bucketName: string, filePath: string, newName: string) => {
  const newFilePath = joinPath(dirName(filePath), validateName(newName, 'newName'));
  if (newFilePath === filePath) return newFilePath;
  assertNotReserved(newFilePath);
  await assertFileAbsent(bucketName, newFilePath);

  await getBucket(bucketName).file(filePath).move(newFilePath);

  // Update kb.ndjson — find by path, keep UUID stable
  await mutateKbMetadata(bucketName, metadata => {
    const entry = metadata.find(m => pathFromUri(m.content.uri) === filePath);
    if (!entry) return null;
    entry.content.uri = `gs://${bucketName}/${newFilePath}`;
    entry.structData.title = newName;
    return metadata;
  });
  return newFilePath;
};

export const moveFile = async (bucketName: string, filePath: string, newFolderPath: string) => {
  const folder = normalizeFolderPath(newFolderPath);
  const fileName = filePath.split('/').pop() || filePath;
  const newFilePath = joinPath(folder, fileName);
  if (newFilePath === filePath) return newFilePath;
  assertNotReserved(newFilePath);
  await assertFileAbsent(bucketName, newFilePath);

  await getBucket(bucketName).file(filePath).move(newFilePath);

  // Update kb.ndjson — find by path, keep UUID stable
  await mutateKbMetadata(bucketName, metadata => {
    const entry = metadata.find(m => pathFromUri(m.content.uri) === filePath);
    if (!entry) return null;
    entry.content.uri = `gs://${bucketName}/${newFilePath}`;
    entry.structData.folder = folder;
    return metadata;
  });
  return newFilePath;
};

// KB JSON Management

/**
 * Parse kb.ndjson content. Records are separated by real newlines only: a
 * newline inside a string value is serialized by JSON.stringify as the
 * two-character escape `\n`, which must not be treated as a separator.
 * Throws on a malformed line so a bad read can never be saved back as data loss.
 */
export const parseKbNdjson = (content: string): KbEntry[] =>
  content.split('\n').flatMap((line, i) => {
    if (line.trim() === '') return [];
    try {
      return [JSON.parse(line) as KbEntry];
    } catch (err: any) {
      throw new Error(`Invalid ${kbJsonFile} line ${i + 1}: ${err.message}`);
    }
  });

export const serializeKbNdjson = (metadata: KbEntry[]): string =>
  metadata.map(entry => JSON.stringify(entry)).join('\n') + '\n';

/** Read kb.ndjson along with its GCS generation (0 when the file does not exist yet). */
const readKbMetadata = async (bucketName: string): Promise<{ entries: KbEntry[]; generation: number | string }> => {
  const bucket = getBucket(bucketName);
  let generation: number | string;
  try {
    const [md] = await bucket.file(kbJsonFile).getMetadata();
    generation = md.generation ?? 0;
  } catch (err: any) {
    if (err.code === 404) return { entries: [], generation: 0 };
    throw err;
  }
  const [content] = await bucket.file(kbJsonFile, { generation }).download();
  return { entries: parseKbNdjson(content.toString('utf-8')), generation };
};

export const getKbMetadata = async (bucketName: string): Promise<KbEntry[]> =>
  (await readKbMetadata(bucketName)).entries;

/**
 * Read-modify-write kb.ndjson atomically. The write is conditioned on the
 * generation that was read, so a concurrent update makes it fail with 412 and
 * the mutation is re-applied on fresh data instead of silently overwriting it.
 * `mutate` returns the new entries, or null when nothing changed.
 */
export const mutateKbMetadata = async (
  bucketName: string,
  mutate: (entries: KbEntry[]) => KbEntry[] | null,
): Promise<void> => {
  const file = getBucket(bucketName).file(kbJsonFile);
  for (let attempt = 1; ; attempt++) {
    const { entries, generation } = await readKbMetadata(bucketName);
    const updated = mutate(entries);
    if (!updated) return;
    try {
      await file.save(serializeKbNdjson(updated), {
        resumable: false,
        metadata: { contentType: 'application/x-ndjson' },
        preconditionOpts: { ifGenerationMatch: generation },
      });
      return;
    } catch (err: any) {
      if (err.code !== 412 || attempt >= KB_WRITE_MAX_ATTEMPTS) throw err;
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 * attempt));
    }
  }
};

/** Add entries for freshly uploaded files. An upload over an existing path keeps that entry's UUID. Returns the final ids. */
export const appendKbEntries = async (bucketName: string, entries: KbEntry[]): Promise<string[]> => {
  let ids: string[] = [];
  await mutateKbMetadata(bucketName, metadata => {
    const byUri = new Map(metadata.map((m, i) => [m.content.uri, i]));
    ids = entries.map(entry => {
      const existingIdx = byUri.get(entry.content.uri);
      if (existingIdx === undefined) {
        byUri.set(entry.content.uri, metadata.push(entry) - 1);
        return entry.id;
      }
      const existingId = metadata[existingIdx].id;
      metadata[existingIdx] = { ...entry, id: existingId };
      return existingId;
    });
    return metadata;
  });
  return ids;
};

export const updateKbEntry = async (bucketName: string, id: string, updates: Partial<KbEntry['structData']>) => {
  let updated: KbEntry | undefined;
  await mutateKbMetadata(bucketName, metadata => {
    updated = metadata.find(m => m.id === id);
    if (!updated) return null;
    updated.structData = { ...updated.structData, ...updates };
    return metadata;
  });
  return updated;
};

export const bulkUpdateKbEntries = async (bucketName: string, updates: Map<string, Partial<KbEntry['structData']>>) => {
  await mutateKbMetadata(bucketName, metadata => {
    for (const entry of metadata) {
      const upd = updates.get(entry.id);
      if (upd) {
        entry.structData = { ...entry.structData, ...upd };
      }
    }
    return metadata;
  });
};

export const renameFolder = async (bucketName: string, oldPath: string, newPath: string) => {
  const oldFolder = normalizeFolderPath(oldPath);
  const newFolder = normalizeFolderPath(newPath);
  if (!oldFolder || !newFolder) throw badRequest('folder path is required');
  if (oldFolder === newFolder) return;
  const oldPrefix = oldFolder + '/';
  const newPrefix = newFolder + '/';
  if (newPrefix.startsWith(oldPrefix)) throw badRequest('Cannot move a folder into itself');

  const bucket = getBucket(bucketName);
  const [existing] = await bucket.getFiles({ prefix: newPrefix, maxResults: 1 });
  if (existing.length > 0) throw conflict(`A folder already exists at ${newFolder}`);

  const [files] = await bucket.getFiles({ prefix: oldPrefix });
  for (const file of files) {
    const newName = newPrefix + file.name.slice(oldPrefix.length);
    await file.move(newName);
  }

  // Update kb.ndjson entries — match by path prefix, keep UUIDs stable
  await mutateKbMetadata(bucketName, metadata => {
    let changed = false;
    for (const entry of metadata) {
      const entryPath = pathFromUri(entry.content.uri);
      if (entryPath.startsWith(oldPrefix)) {
        const newFilePath = newPrefix + entryPath.slice(oldPrefix.length);
        entry.content.uri = `gs://${bucketName}/${newFilePath}`;
        entry.structData.folder = dirName(newFilePath);
        changed = true;
      }
    }
    return changed ? metadata : null;
  });
};

export const deleteFolder = async (bucketName: string, folderPath: string) => {
  const folder = normalizeFolderPath(folderPath);
  if (!folder) throw badRequest('folder path is required');
  const bucket = getBucket(bucketName);
  const prefix = folder + '/';
  const [files] = await bucket.getFiles({ prefix });

  // Collect paths to remove from kb.ndjson
  const pathsToRemove = new Set<string>();
  for (const file of files) {
    if (!file.name.endsWith('/') && file.name !== kbJsonFile) {
      pathsToRemove.add(file.name);
    }
    await file.delete({ ignoreNotFound: true });
  }

  if (pathsToRemove.size > 0) {
    await mutateKbMetadata(bucketName, metadata =>
      metadata.filter(m => !pathsToRemove.has(pathFromUri(m.content.uri))));
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

export const deleteAllFiles = async (bucketName: string) => {
  const bucket = getBucket(bucketName);
  const [files] = await bucket.getFiles();

  for (const file of files) {
    // Keep kb.ndjson file itself but we'll clear it after
    if (file.name === kbJsonFile) continue;
    await file.delete({ ignoreNotFound: true });
  }

  // Clear kb.ndjson
  await mutateKbMetadata(bucketName, () => []);
};
