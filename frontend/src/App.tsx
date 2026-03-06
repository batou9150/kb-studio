import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { api } from './api';
import type { FileItem } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Explorer } from './components/Explorer';
import { DetailsPanel } from './components/DetailsPanel';
import { DuplicateDialog } from './components/DuplicateDialog';
import { AnalyzeResultsDialog } from './components/AnalyzeResultsDialog';
import { AdminPanel } from './components/AdminPanel';
import { SearchPanel } from './components/SearchPanel';
import { AnswerPanel } from './components/AnswerPanel';
import { Loader } from 'lucide-react';

function App() {
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [projectId, setProjectId] = useState('');

  const [currentView, setCurrentView] = useState<'explorer' | 'admin' | 'index' | 'answer'>('explorer');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Batch analysis state
  const [analyzeProgress, setAnalyzeProgress] = useState<
    | { state: 'preparing' }
    | { state: 'starting' }
    | { state: 'running'; done: number; total: number }
    | null
  >(null);
  const batchNameRef = useRef<string | null>(null);

  // Analyze results state
  const [analyzeResults, setAnalyzeResults] = useState<{
    results: { id: string; description: string; value_date: string; category: string }[];
    failed: { id: string; error: string }[];
  } | null>(null);

  // Duplicate detection state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingFolder, setPendingFolder] = useState<string>('');
  const [duplicates, setDuplicates] = useState<{name: string, id: string}[]>([]);

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
    document.title = import.meta.env.VITE_APP_NAME || 'KB-Studio';
    api.getConfig().then(({ bucketName, projectId }) => {
      setBucketName(bucketName);
      setProjectId(projectId);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep selectedFile in sync with refreshed files list
  useEffect(() => {
    if (selectedFile) {
      const updated = files.find(f => f.id === selectedFile.id);
      if (updated && updated !== selectedFile) {
        setSelectedFile(updated);
      }
    }
  }, [files, selectedFile]);

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
        setDuplicates(duplicates);
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
    const nameToId = new Map(duplicates.map(d => [d.name, d.id]));
    setPendingFiles([]);
    setPendingFolder('');
    setDuplicates([]);

    try {
      setLoading(true);

      // Split into new files and existing files to overwrite
      const newFiles = filesToUpload.filter(f => !nameToId.has(f.name));
      const existingFiles = filesToUpload.filter(f => nameToId.has(f.name));

      // Upload new files in batch
      if (newFiles.length > 0) {
        await api.uploadFiles(newFiles, targetFolder);
      }

      // Overwrite existing files one by one via PUT using UUID
      for (const file of existingFiles) {
        const id = nameToId.get(file.name)!;
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
    setDuplicates([]);
  };

  const handleSelectFile = (file: FileItem) => {
    setSelectedFile(file);
    setIsPanelOpen(true);
  };

  const handleUpdateMetadata = async (id: string, description: string, date: string, category: string) => {
    try {
      await api.updateFileMetadata(id, description, date, category);
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

  const handleAnalyzeAll = async () => {
    try {
      setAnalyzeProgress({ state: 'preparing' });
      const { batchName } = await api.startAnalyzeAll();
      batchNameRef.current = batchName;
      setAnalyzeProgress({ state: 'starting' });
    } catch (err) {
      setAnalyzeProgress(null);
      alert('Erreur lors du lancement de l\'analyse.');
    }
  };

  useEffect(() => {
    if (!batchNameRef.current) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getAnalyzeAllStatus(batchNameRef.current!);
        if (status.state === 'succeeded') {
          batchNameRef.current = null;
          setAnalyzeProgress(null);
          setAnalyzeResults({
            results: status.results ?? [],
            failed: status.failed ?? [],
          });
          loadData();
        } else if (status.state === 'failed' || status.state === 'cancelled') {
          batchNameRef.current = null;
          setAnalyzeProgress(null);
          alert('L\'analyse batch a échoué.');
        } else {
          const done = status.succeededCount ?? 0;
          const total = status.totalCount ?? 0;
          if (total > 0) {
            setAnalyzeProgress({ state: 'running', done, total });
          } else {
            setAnalyzeProgress({ state: 'starting' });
          }
        }
      } catch {
        // Ignore polling errors, retry next interval
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [analyzeProgress, loadData]);

  return (
    <div className="app-container">
      {analyzeResults && (
        <AnalyzeResultsDialog
          results={analyzeResults.results}
          failed={analyzeResults.failed}
          onClose={() => setAnalyzeResults(null)}
        />
      )}

      {duplicates.length > 0 && (
        <DuplicateDialog
          duplicates={duplicates}
          onOverwrite={handleDuplicateOverwrite}
          onCancel={handleDuplicateCancel}
        />
      )}

      <Header
        currentView={currentView}
        onNavigate={handleSelectFolder}
        onViewChange={setCurrentView}
      />

      {currentView === 'admin' ? (
        <div className="main-content">
          <AdminPanel folders={folders} onDataChanged={loadData} />
        </div>
      ) : currentView === 'index' ? (
        <div className="main-content">
          <SearchPanel />
        </div>
      ) : currentView === 'answer' ? (
        <div className="main-content">
          <AnswerPanel />
        </div>
      ) : (
        <div className="main-content">
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
              onSearch={setSearchQuery}
              onAnalyzeAll={handleAnalyzeAll}
              analyzeProgress={analyzeProgress}
              bucketName={bucketName}
              projectId={projectId}
              sidebar={
                <Sidebar
                  folders={folders}
                  currentFolder={currentFolder}
                  onSelectFolder={handleSelectFolder}
                  onMoveFile={handleMoveFile}
                  onUploadToFolder={handleUploadToFolder}
                  onCreateFolder={handleCreateFolder}
                />
              }
              detailsPanel={
                <DetailsPanel
                  file={selectedFile}
                  isOpen={isPanelOpen}
                  onClose={() => setIsPanelOpen(false)}
                  onUpdateMetadata={handleUpdateMetadata}
                  onRenameFile={handleRenameFile}
                />
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
