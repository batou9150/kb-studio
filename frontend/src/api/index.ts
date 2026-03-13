import axios from 'axios';
import type { FileItem, ImportOperationStatus, ImportHistoryEntry, AnswerQueryResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

let currentBucket = '';
export function setCurrentBucket(bucket: string) { currentBucket = bucket; }

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Auto-append ?bucket= to all API calls
apiClient.interceptors.request.use((config) => {
  if (currentBucket) {
    config.params = { ...config.params, bucket: currentBucket };
  }
  return config;
});

export const api = {
  // Config
  getConfig: async (): Promise<{ bucketName: string; bucketNames: string[]; projectId: string; appName: string; appLogo: string }> => {
    const res = await apiClient.get('/config');
    return res.data;
  },

  // Folders
  getFolders: async (): Promise<string[]> => {
    const res = await apiClient.get('/folders');
    return res.data;
  },
  createFolder: async (path: string) => {
    const res = await apiClient.post('/folders', { path });
    return res.data;
  },
  
  // Files
  checkDuplicates: async (fileNames: string[]): Promise<{ duplicates: {name: string, id: string}[] }> => {
    const res = await apiClient.post('/files/check-duplicates', { fileNames });
    return res.data;
  },
  getFiles: async (folderId?: string, search?: string): Promise<FileItem[]> => {
    const params: Record<string, string> = {};
    if (folderId) params.folderId = folderId;
    if (search) params.search = search;

    const res = await apiClient.get('/files', { params });
    return res.data;
  },
  uploadFiles: async (files: File[], folderId: string) => {
    const formData = new FormData();
    const relativePaths = files.map(f => {
      // webkitRelativePath is set by <input webkitdirectory>
      // path is set by file-selector (react-dropzone) on folder drops
      const rp = (f.webkitRelativePath || (f as any).path || '').replace(/^\.?\//, '');
      // Extract the directory portion (strip the filename)
      const lastSlash = rp.lastIndexOf('/');
      return lastSlash > -1 ? rp.substring(0, lastSlash) : '';
    });
    files.forEach(f => formData.append('files', f));
    formData.append('folderId', folderId);
    formData.append('relativePaths', JSON.stringify(relativePaths));

    const res = await apiClient.post('/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  updateFile: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await apiClient.put(`/files/${encodeURIComponent(id)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  updateFileMetadata: async (id: string, description: string, value_date: string, category: string) => {
    const res = await apiClient.patch(`/files/${encodeURIComponent(id)}`, { description, value_date, category });
    return res.data;
  },
  analyzeFile: async (id: string): Promise<{ description: string; value_date: string; category: string }> => {
    const res = await apiClient.post(`/files/${encodeURIComponent(id)}/analyze`);
    return res.data;
  },
  startAnalyzeAll: async (): Promise<{ batchName: string; totalFiles: number }> => {
    const res = await apiClient.post('/files/analyze-all');
    return res.data;
  },
  getAnalyzeAllStatus: async (batchName: string, bucket?: string) => {
    const params: Record<string, string> = { batchName };
    if (bucket) params.bucket = bucket;
    const res = await apiClient.get('/files/analyze-all/status', { params });
    return res.data;
  },
  getAnalyzeHistory: async (): Promise<{ name: string; state: string; displayName: string; createTime: string; endTime: string }[]> => {
    const res = await apiClient.get('/files/analyze-all/history');
    return res.data;
  },
  getAnalyzeDetails: async (batchName: string): Promise<{ results: { id: string; description: string; value_date: string; category: string }[]; failed: { id: string; error: string }[] }> => {
    const res = await apiClient.get(`/files/analyze-all/${encodeURIComponent(batchName)}/details`);
    return res.data;
  },
  detectDuplicates: async (lang: string): Promise<{ groups: { ids: string[]; reason: string }[] }> => {
    const res = await apiClient.post('/files/duplicates', { lang });
    return res.data;
  },
  deleteFile: async (id: string) => {
    const res = await apiClient.delete(`/files/${encodeURIComponent(id)}`);
    return res.data;
  },
  getDownloadUrl: (id: string): string => {
    const url = `${API_BASE_URL}/files/${encodeURIComponent(id)}/download`;
    return currentBucket ? `${url}?bucket=${encodeURIComponent(currentBucket)}` : url;
  },
  renameFile: async (id: string, newName: string) => {
    const res = await apiClient.put(`/files/${encodeURIComponent(id)}/rename`, { newName });
    return res.data;
  },
  moveFile: async (id: string, newFolderId: string) => {
    const res = await apiClient.put(`/files/${encodeURIComponent(id)}/move`, { newFolderId });
    return res.data;
  },
  renameFolder: async (id: string, newName: string) => {
    const res = await apiClient.put(`/folders/${encodeURIComponent(id)}`, { newName });
    return res.data;
  },
  deleteFolder: async (id: string) => {
    const res = await apiClient.delete(`/folders/${encodeURIComponent(id)}`);
    return res.data;
  },
  deleteAllFiles: async () => {
    const res = await apiClient.delete('/files');
    return res.data;
  },
  getPreviewUrl: (id: string): string => {
    const url = `${API_BASE_URL}/files/${encodeURIComponent(id)}/preview`;
    return currentBucket ? `${url}?bucket=${encodeURIComponent(currentBucket)}` : url;
  },
  getTextContent: async (id: string): Promise<string> => {
    const res = await apiClient.get(`/files/${encodeURIComponent(id)}/download`, {
      responseType: 'text',
    });
    return res.data;
  },

  // Search / Datastore management
  listDataStores: async (): Promise<{ dataStoreId: string; displayName: string; location: string; engine: { engineId: string; displayName: string; solutionType: string; searchTier: string; searchAddOns: string[] } | null }[]> => {
    const res = await apiClient.get('/search/datastores');
    return res.data;
  },
  createDataStore: async (dataStoreId: string, displayName: string, location: string, documentProcessingConfig?: any, appConfig?: { searchTier: 'standard' | 'enterprise'; enableLlm: boolean }) => {
    const res = await apiClient.post('/search/datastores', { dataStoreId, displayName, location, documentProcessingConfig, appConfig });
    return res.data;
  },
  importDocuments: async (dataStoreId: string, location: string, mode?: string): Promise<{ operationName: string }> => {
    const res = await apiClient.post(`/search/datastores/${encodeURIComponent(dataStoreId)}/import`, { location, mode });
    return res.data;
  },
  getImportOperationStatus: async (operationName: string, location: string): Promise<ImportOperationStatus> => {
    const res = await apiClient.get('/search/operations/status', { params: { name: operationName, location } });
    return res.data;
  },
  listImportOperations: async (dataStoreId: string, location: string): Promise<ImportHistoryEntry[]> => {
    const res = await apiClient.get(`/search/datastores/${encodeURIComponent(dataStoreId)}/imports`, { params: { location } });
    return res.data;
  },
  getDataStoreStatus: async (dataStoreId: string, location: string) => {
    const res = await apiClient.get(`/search/datastores/${encodeURIComponent(dataStoreId)}/status`, { params: { location } });
    return res.data;
  },
  purgeDocuments: async (dataStoreId: string, location: string) => {
    const res = await apiClient.delete(`/search/datastores/${encodeURIComponent(dataStoreId)}/documents`, { params: { location } });
    return res.data;
  },
  listDataStoreDocuments: async (dataStoreId: string, location: string, pageSize?: number, pageToken?: string) => {
    const res = await apiClient.get(`/search/datastores/${encodeURIComponent(dataStoreId)}/documents`, { params: { location, pageSize, pageToken } });
    return res.data;
  },
  deleteDataStore: async (dataStoreId: string, location: string) => {
    const res = await apiClient.delete(`/search/datastores/${encodeURIComponent(dataStoreId)}`, { params: { location } });
    return res.data;
  },
  answerQuery: async (dataStoreId: string, location: string, query: string): Promise<AnswerQueryResponse> => {
    const res = await apiClient.post(`/search/datastores/${encodeURIComponent(dataStoreId)}/answer`, { location, query });
    return res.data;
  },
  searchQuery: async (dataStoreId: string, location: string, query: string): Promise<AnswerQueryResponse> => {
    const res = await apiClient.post(`/search/datastores/${encodeURIComponent(dataStoreId)}/search`, { location, query });
    return res.data;
  },
};
