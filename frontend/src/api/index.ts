import axios from 'axios';
import type { FileItem } from '../types';

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
  getFiles: async (folderId?: string, search?: string): Promise<FileItem[]> => {
    const params = new URLSearchParams();
    if (folderId) params.append('folderId', folderId);
    if (search) params.append('search', search);
    
    const res = await apiClient.get(`/files?${params.toString()}`);
    return res.data;
  },
  uploadFiles: async (files: File[], folderId: string) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('folderId', folderId);
    
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
  updateFileMetadata: async (id: string, description: string, date_valeur: string) => {
    const res = await apiClient.patch(`/files/${encodeURIComponent(id)}`, { description, date_valeur });
    return res.data;
  },
  deleteFile: async (id: string) => {
    const res = await apiClient.delete(`/files/${encodeURIComponent(id)}`);
    return res.data;
  },
  downloadFile: async (id: string): Promise<{ url: string }> => {
    const res = await apiClient.get(`/files/${encodeURIComponent(id)}/download`);
    return res.data;
  },
  moveFile: async (id: string, newFolderId: string) => {
    const res = await apiClient.put(`/files/${encodeURIComponent(id)}/move`, { newFolderId });
    return res.data;
  }
};
