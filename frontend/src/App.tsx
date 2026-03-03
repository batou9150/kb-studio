import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api } from './api';
import type { FileItem } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Explorer } from './components/Explorer';
import { DetailsPanel } from './components/DetailsPanel';
import { DuplicateDialog } from './components/DuplicateDialog';
import { AdminPanel } from './components/AdminPanel';
import { Loader } from 'lucide-react';

function App() {
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentView, setCurrentView] = useState<'explorer' | 'admin'>('explorer');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Duplicate detection state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingFolder, setPendingFolder] = useState<string>('');
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);

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

  const handleUploadToFolder = async (uploadFiles: File[], targetFolder: string) => {
    try {
      // Check for duplicates before uploading
      const fileNames = uploadFiles.map(f => f.name);
      const { duplicates } = await api.checkDuplicates(fileNames);

      if (duplicates.length > 0) {
        // Store pending files and target folder, show dialog
        setPendingFiles(uploadFiles);
        setPendingFolder(targetFolder);
        setDuplicateNames(duplicates);
        return;
      }

      // No duplicates — upload directly
      setLoading(true);
      await api.uploadFiles(uploadFiles, targetFolder);
      await loadData();
    } catch (err) {
      alert('Erreur lors du téléversement.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (uploadFiles: File[]) => handleUploadToFolder(uploadFiles, currentFolder);

  const handleDuplicateOverwrite = async () => {
    const filesToUpload = pendingFiles;
    const targetFolder = pendingFolder;
    const duplicates = new Set(duplicateNames);
    setPendingFiles([]);
    setPendingFolder('');
    setDuplicateNames([]);

    try {
      setLoading(true);

      // Split into new files and existing files to overwrite
      const newFiles = filesToUpload.filter(f => !duplicates.has(f.name));
      const existingFiles = filesToUpload.filter(f => duplicates.has(f.name));

      // Upload new files in batch
      if (newFiles.length > 0) {
        await api.uploadFiles(newFiles, targetFolder);
      }

      // Overwrite existing files one by one via PUT
      for (const file of existingFiles) {
        const filePath = targetFolder
          ? `${targetFolder.endsWith('/') ? targetFolder : targetFolder + '/'}${file.name}`
          : file.name;
        const id = encodeURIComponent(filePath);
        await api.updateFile(id, file);
      }

      await loadData();
    } catch (err) {
      alert('Erreur lors du téléversement.');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateCancel = () => {
    setPendingFiles([]);
    setPendingFolder('');
    setDuplicateNames([]);
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

  const handleRenameFile = async (id: string, newName: string) => {
    try {
      await api.renameFile(id, newName);
      setIsPanelOpen(false);
      setSelectedFile(null);
      loadData();
    } catch (err) {
      alert('Erreur lors du renommage.');
    }
  };

  const handleDownloadFile = (id: string) => {
    window.open(api.getDownloadUrl(id), '_blank');
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

  const handleMoveFile = async (fileId: string, newFolderId: string) => {
    try {
      await api.moveFile(fileId, newFolderId);
      setIsPanelOpen(false);
      setSelectedFile(null);
      loadData();
    } catch (err) {
      alert('Erreur lors du déplacement.');
    }
  };

  return (
    <div className="app-container">
      {duplicateNames.length > 0 && (
        <DuplicateDialog
          duplicateNames={duplicateNames}
          onOverwrite={handleDuplicateOverwrite}
          onCancel={handleDuplicateCancel}
        />
      )}

      <Header
        currentFolder={currentFolder}
        currentView={currentView}
        onSearch={setSearchQuery}
        onNavigate={handleSelectFolder}
        onViewChange={setCurrentView}
      />

      {currentView === 'admin' ? (
        <div className="main-content">
          <AdminPanel folders={folders} onDataChanged={loadData} />
        </div>
      ) : (
        <div className="main-content">
          <Sidebar
            folders={folders}
            currentFolder={currentFolder}
            onSelectFolder={handleSelectFolder}
            onMoveFile={handleMoveFile}
            onUploadToFolder={handleUploadToFolder}
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
              onRenameFile={handleRenameFile}
              onCreateFolder={handleCreateFolder}
            />
          )}

          <DetailsPanel
            file={selectedFile}
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            onUpdateMetadata={handleUpdateMetadata}
            onRenameFile={handleRenameFile}
          />
        </div>
      )}
    </div>
  );
}

export default App;
