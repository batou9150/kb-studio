import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api } from './api';
import type { FileItem } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Explorer } from './components/Explorer';
import { DetailsPanel } from './components/DetailsPanel';
import { Loader } from 'lucide-react';

function App() {
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [foldersData, filesData] = await Promise.all([
        api.getFolders(),
        api.getFiles(currentFolder, searchQuery)
      ]);
      setFolders(foldersData);
      setFiles(filesData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  }, [currentFolder, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectFolder = (folderId: string) => {
    setCurrentFolder(folderId);
    setSelectedFile(null);
    setIsPanelOpen(false);
  };

  const handleCreateFolder = async () => {
    const folderName = prompt('Nom du nouveau dossier:');
    if (folderName) {
      try {
        const path = currentFolder ? `${currentFolder}${folderName}/` : `${folderName}/`;
        await api.createFolder(path);
        loadData();
      } catch (err) {
        alert('Erreur lors de la création du dossier.');
      }
    }
  };

  const handleUpload = async (uploadFiles: File[]) => {
    try {
      setLoading(true);
      await api.uploadFiles(uploadFiles, currentFolder);
      await loadData();
    } catch (err) {
      alert('Erreur lors du téléversement.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = (file: FileItem) => {
    setSelectedFile(file);
    setIsPanelOpen(true);
  };

  const handleUpdateMetadata = async (id: string, description: string, date: string) => {
    try {
      await api.updateFileMetadata(id, description, date);
      alert('Métadonnées mises à jour avec succès.');
      loadData();
    } catch (err) {
      alert('Erreur lors de la mise à jour.');
    }
  };

  const handleDownloadFile = async (id: string) => {
    try {
      const { url } = await api.downloadFile(id);
      window.open(url, '_blank');
    } catch (err) {
      alert('Erreur lors du téléchargement.');
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce fichier ?')) {
      try {
        await api.deleteFile(id);
        setIsPanelOpen(false);
        setSelectedFile(null);
        loadData();
      } catch (err) {
        alert('Erreur lors de la suppression.');
      }
    }
  };

  const handleMoveFile = async (id: string) => {
    const newFolderId = prompt('Entrez le chemin du dossier cible (ex: RH/Contrats/):', currentFolder);
    if (newFolderId !== null) {
      try {
        await api.moveFile(id, newFolderId);
        setIsPanelOpen(false);
        setSelectedFile(null);
        loadData();
      } catch (err) {
        alert('Erreur lors du déplacement.');
      }
    }
  };

  return (
    <div className="app-container">
      <Header 
        currentFolder={currentFolder} 
        onSearch={setSearchQuery} 
        onNavigate={handleSelectFolder}
      />
      
      <div className="main-content">
        <Sidebar 
          folders={folders} 
          currentFolder={currentFolder} 
          onSelectFolder={handleSelectFolder} 
        />
        
        {loading && files.length === 0 ? (
          <div className="explorer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader className="spinner" size={48} color="var(--primary-color)" />
          </div>
        ) : (
          <Explorer 
            files={files} 
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
            onUpload={handleUpload}
            onDeleteFile={handleDeleteFile}
            onDownloadFile={handleDownloadFile}
            onCreateFolder={handleCreateFolder}
          />
        )}
        
        <DetailsPanel 
          file={selectedFile} 
          isOpen={isPanelOpen} 
          onClose={() => setIsPanelOpen(false)}
          onUpdateMetadata={handleUpdateMetadata}
          onDownload={handleDownloadFile}
          onDelete={handleDeleteFile}
          onMove={handleMoveFile}
        />
      </div>
    </div>
  );
}

export default App;
