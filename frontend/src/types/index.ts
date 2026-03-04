export interface Metadata {
  id: string;
  structData: {
    title: string;
    description: string;
    value_date: string;
  };
  content: {
    mimeType: string;
    uri: string;
  };
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: string;
  contentType: string;
  updated: string;
  metadata: Metadata | null;
}

export interface FolderNode {
  id: string; // The full path acting as ID, e.g., "RH/Contrats/"
  name: string; // The last part, e.g., "Contrats"
  path: string;
  children?: FolderNode[];
}

export interface DataStoreConfig {
  dataStoreId: string;
  displayName: string;
  location: string;   // "global", "eu", "us"
}

export interface DataStoreStatus {
  exists: boolean;
  documentCount: number;
  kbEntryCount: number;
  kbNdjsonUpdatedAt: string | null;
  lastImportTime: string | null;
  lastImportDone: boolean;
  lastImportSuccessCount: number;
  lastImportFailureCount: number;
  lastImportTotalCount: number;
  isUpToDate: boolean;
  consoleUrl: string | null;
}

export interface DataStoreDocument {
  id: string;
  uri: string;
  structData: Record<string, any>;
  indexState: 'indexed' | 'pending' | 'error';
  indexPendingMessage: string | null;
}

export interface ImportOperationStatus {
  name: string;
  done: boolean;
  successCount: number;
  failureCount: number;
  totalCount: number;
  error?: string | null;
}

export interface ImportHistoryEntry {
  name: string;
  done: boolean;
  createTime: string | null;
  updateTime: string | null;
  successCount: number;
  failureCount: number;
  totalCount: number;
  error: string | null;
}
