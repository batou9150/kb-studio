import { v1beta, protos } from '@google-cloud/discoveryengine';
import { Storage } from '@google-cloud/storage';

const projectId = process.env.GOOGLE_CLOUD_PROJECT!;
const bucketName = process.env.GCS_BUCKET_NAME || 'kb-studio-bucket';
const storage = new Storage();

function apiEndpoint(location: string): string | undefined {
  if (location === 'global') return undefined; // use default endpoint
  return `${location}-discoveryengine.googleapis.com`;
}

function getDataStoreClient(location: string) {
  const apiEndpointVal = apiEndpoint(location);
  return apiEndpointVal
    ? new v1beta.DataStoreServiceClient({ apiEndpoint: apiEndpointVal })
    : new v1beta.DataStoreServiceClient();
}

function getDocumentClient(location: string) {
  const apiEndpointVal = apiEndpoint(location);
  return apiEndpointVal
    ? new v1beta.DocumentServiceClient({ apiEndpoint: apiEndpointVal })
    : new v1beta.DocumentServiceClient();
}

function collectionPath(location: string) {
  return `projects/${projectId}/locations/${location}/collections/default_collection`;
}

function dataStorePath(dataStoreId: string, location: string) {
  return `${collectionPath(location)}/dataStores/${dataStoreId}`;
}

function branchPath(dataStoreId: string, location: string) {
  return `${dataStorePath(dataStoreId, location)}/branches/default_branch`;
}

const LOCATIONS = ['global', 'eu', 'us'];

export async function listDataStores() {
  const results: { dataStoreId: string; displayName: string; location: string }[] = [];

  await Promise.all(LOCATIONS.map(async (loc) => {
    try {
      const client = getDataStoreClient(loc);
      const parent = collectionPath(loc);
      const [dataStores] = await client.listDataStores({ parent });
      for (const ds of dataStores) {
        // Extract dataStoreId from name: .../dataStores/{id}
        const parts = (ds.name ?? '').split('/');
        const id = parts[parts.length - 1];
        results.push({ dataStoreId: id, displayName: ds.displayName ?? id, location: loc });
      }
    } catch {}
  }));

  return results;
}

export async function createDataStore(dataStoreId: string, displayName: string, location: string, documentProcessingConfig?: any) {
  const parent = collectionPath(location);
  const result = await getDataStoreClient(location).createDataStore({
    parent,
    dataStoreId,
    dataStore: {
      displayName,
      industryVertical: 1, // GENERIC
      solutionTypes: [2],  // SOLUTION_TYPE_SEARCH
      contentConfig: 2,    // CONTENT_REQUIRED
      ...(documentProcessingConfig && { documentProcessingConfig }),
    },
  });
  const operation = result[0];
  const [dataStore] = await operation.promise();
  return dataStore;
}

export async function startImport(dataStoreId: string, location: string, mode: 'FULL' | 'INCREMENTAL' = 'INCREMENTAL') {
  const parent = branchPath(dataStoreId, location);
  const [operation] = await getDocumentClient(location).importDocuments({
    parent,
    gcsSource: {
      inputUris: [`gs://${bucketName}/kb.ndjson`],
      dataSchema: 'document',
    },
    reconciliationMode: mode,
  });

  return { operationName: operation.name! };
}

export async function getImportOperationStatus(operationName: string, location: string) {
  const client = getDocumentClient(location);
  const op = await client.checkImportDocumentsProgress(operationName);
  const metadata = op.metadata as any;

  const result = {
    name: op.name,
    done: op.done ?? false,
    successCount: Number(metadata?.successCount ?? 0),
    failureCount: Number(metadata?.failureCount ?? 0),
    totalCount: Number(metadata?.totalCount ?? 0),
    error: null as string | null,
  };

  if (op.done && op.error) {
    result.error = op.error.message ?? 'Import failed';
  }

  return result;
}

function timestampToISO(ts: any): string | null {
  if (!ts) return null;
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  return new Date(seconds * 1000 + nanos / 1e6).toISOString();
}

export async function listImportOperations(dataStoreId: string, location: string) {
  const client = getDocumentClient(location);
  const name = branchPath(dataStoreId, location);
  const ImportDocumentsMetadata = protos.google.cloud.discoveryengine.v1beta.ImportDocumentsMetadata;

  const operations: {
    name: string;
    done: boolean;
    createTime: string | null;
    updateTime: string | null;
    successCount: number;
    failureCount: number;
    totalCount: number;
    error: string | null;
  }[] = [];

  for await (const op of client.listOperationsAsync({ name } as any)) {
    if (!op.name?.includes('import-documents')) continue;

    let metadata: protos.google.cloud.discoveryengine.v1beta.IImportDocumentsMetadata = {};
    if (op.metadata?.value) {
      try {
        metadata = ImportDocumentsMetadata.decode(op.metadata.value as Uint8Array);
      } catch {}
    }

    operations.push({
      name: op.name,
      done: op.done ?? false,
      createTime: timestampToISO(metadata.createTime),
      updateTime: timestampToISO(metadata.updateTime),
      successCount: Number(metadata.successCount ?? 0),
      failureCount: Number(metadata.failureCount ?? 0),
      totalCount: Number(metadata.totalCount ?? 0),
      error: op.done && op.error ? (op.error.message ?? 'Import failed') : null,
    });
  }

  // Sort by createTime descending (most recent first)
  operations.sort((a, b) => (b.createTime ?? '').localeCompare(a.createTime ?? ''));

  return operations;
}

export async function getDataStoreStatus(dataStoreId: string, location: string) {
  // Get datastore info
  const name = dataStorePath(dataStoreId, location);
  try {
    await getDataStoreClient(location).getDataStore({ name });
  } catch (err: any) {
    if (err.code === 5) {
      return { exists: false, documentCount: 0, kbEntryCount: 0, kbNdjsonUpdatedAt: null, lastImportTime: null, isUpToDate: false, consoleUrl: null };
    }
    throw err;
  }

  // Count documents in datastore
  const parent = branchPath(dataStoreId, location);
  let documentCount = 0;
  let pageToken: string | undefined;
  do {
    const [docs, , resp] = await getDocumentClient(location).listDocuments({ parent, pageSize: 1000, pageToken });
    documentCount += docs.length;
    pageToken = resp?.nextPageToken ?? undefined;
  } while (pageToken);

  // Read kb.ndjson metadata from GCS
  const file = storage.bucket(bucketName).file('kb.ndjson');
  const [exists] = await file.exists();
  let kbEntryCount = 0;
  let kbNdjsonUpdatedAt: string | null = null;

  if (exists) {
    const [meta] = await file.getMetadata();
    kbNdjsonUpdatedAt = (meta.updated as string) ?? null;

    const [content] = await file.download();
    const lines = content.toString().trim().split(/\n/);
    kbEntryCount = lines.filter(l => l.trim() !== '').length;
  }

  // Get last import info from operation history
  const imports = await listImportOperations(dataStoreId, location);
  const lastImport = imports[0] ?? null;
  const lastImportTime = lastImport?.createTime ?? null;
  const lastImportDone = lastImport?.done ?? false;
  const lastImportSuccessCount = lastImport?.successCount ?? 0;
  const lastImportFailureCount = lastImport?.failureCount ?? 0;
  const lastImportTotalCount = lastImport?.totalCount ?? 0;

  const isUpToDate = kbEntryCount === documentCount && lastImportTime !== null && kbNdjsonUpdatedAt !== null && kbNdjsonUpdatedAt <= lastImportTime;
  const consoleUrl = `https://console.cloud.google.com/gen-app-builder/locations/${location}/collections/default_collection/data-stores/${dataStoreId}/data/activities?project=${projectId}`;

  return { exists: true, documentCount, kbEntryCount, kbNdjsonUpdatedAt, lastImportTime, lastImportDone, lastImportSuccessCount, lastImportFailureCount, lastImportTotalCount, isUpToDate, consoleUrl };
}

export async function purgeDocuments(dataStoreId: string, location: string) {
  const parent = branchPath(dataStoreId, location);
  const [operation] = await getDocumentClient(location).purgeDocuments({
    parent,
    filter: '*',
    force: true,
  });
  const [response] = await operation.promise();
  return response;
}

export async function listDocuments(dataStoreId: string, location: string, pageSize = 20, pageToken?: string) {
  const parent = branchPath(dataStoreId, location);
  const [docs, , resp] = await getDocumentClient(location).listDocuments({ parent, pageSize, pageToken });

  const documents = docs.map(doc => {
    let structData: Record<string, any> = {};
    if (doc.structData) {
      structData = doc.structData.fields
        ? Object.fromEntries(Object.entries(doc.structData.fields).map(([k, v]: [string, any]) => [k, String(v?.stringValue ?? v?.numberValue ?? v?.boolValue ?? '')]))
        : doc.structData as Record<string, any>;
    }
    if (doc.jsonData) {
      try { structData = JSON.parse(doc.jsonData); } catch {}
    }
    const indexStatus = doc.indexStatus ?? null;
    let indexState: 'indexed' | 'pending' | 'error' = 'pending';
    if (indexStatus?.errorSamples && indexStatus.errorSamples.length > 0) {
      indexState = 'error';
    } else if (indexStatus?.indexTime) {
      indexState = 'indexed';
    }

    return {
      id: doc.id ?? '',
      uri: doc.content?.uri ?? '',
      structData,
      indexState,
      indexPendingMessage: (indexStatus as any)?.pendingMessage ?? null,
    };
  });

  return { documents, nextPageToken: resp?.nextPageToken ?? null };
}
