import axios from 'axios';
import type { FileItem, ImportOperationStatus, ImportHistoryEntry, AnswerQueryResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export const api = {
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
  updateFileMetadata: async (id: string, description: string, value_date: string) => {
    const res = await apiClient.patch(`/files/${encodeURIComponent(id)}`, { description, value_date });
    return res.data;
  },
  deleteFile: async (id: string) => {
    const res = await apiClient.delete(`/files/${encodeURIComponent(id)}`);
    return res.data;
  },
  getDownloadUrl: (id: string): string => {
    return `${API_BASE_URL}/files/${encodeURIComponent(id)}/download`;
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
    return `${API_BASE_URL}/files/${encodeURIComponent(id)}/preview`;
  },
  getTextContent: async (id: string): Promise<string> => {
    const res = await apiClient.get(`/files/${encodeURIComponent(id)}/download`, {
      responseType: 'text',
    });
    return res.data;
  },

  // Search / Datastore management
  listDataStores: async (): Promise<{ dataStoreId: string; displayName: string; location: string }[]> => {
    const res = await apiClient.get('/search/datastores');
    return res.data;
  },
  createDataStore: async (dataStoreId: string, displayName: string, location: string, documentProcessingConfig?: any) => {
    const res = await apiClient.post('/search/datastores', { dataStoreId, displayName, location, documentProcessingConfig });
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
  answerQuery: async (dataStoreId: string, location: string, query: string): Promise<AnswerQueryResponse> => {
    const res = await apiClient.post(`/search/datastores/${encodeURIComponent(dataStoreId)}/answer`, { location, query });
    return res.data;
  },
};
