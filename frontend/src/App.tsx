import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './App.css';
import { api, setCurrentBucket } from './api';
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
import { InsightsPanel } from './components/InsightsPanel';
import { Loader } from 'lucide-react';

function App() {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const setSearchQuery = useCallback((query: string) => {
    setSearchParams(query ? { q: query } : {}, { replace: true });
  }, [setSearchParams]);
  const [bucketNames, setBucketNames] = useState<string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [projectId, setProjectId] = useState('');
  const [appName, setAppName] = useState('KB-Studio');
  const [appLogo, setAppLogo] = useState('');

  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
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
  const batchBucketRef = useRef<string>('');

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
    if (!selectedBucket) return;
    setLoading(true);
    try {
      const [foldersData, filesData, allFilesData] = await Promise.all([
        api.getFolders(),
        api.getFiles(currentFolder, searchQuery),
        api.getFiles(),
      ]);
      setFolders(foldersData);
      setFiles(filesData);
      setAllFiles(allFilesData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert(t('error.loadData'));
    } finally {
      setLoading(false);
    }
  }, [currentFolder, searchQuery, selectedBucket, t]);

  useEffect(() => {
    api.getConfig().then(({ bucketNames: names, projectId, appName, appLogo }) => {
      setBucketNames(names);
      const first = names[0] || '';
      setSelectedBucket(first);
      setCurrentBucket(first);
      setProjectId(projectId);
      if (appName) {
        setAppName(appName);
        document.title = appName;
      }
      if (appLogo) setAppLogo(appLogo);
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

  // Fetch all files (unfiltered) for total count and insights
  const loadAllFiles = useCallback(() => {
    if (!selectedBucket) return;
    api.getFiles().then(setAllFiles).catch(console.error);
  }, [selectedBucket]);

  useEffect(() => { loadAllFiles(); }, [loadAllFiles]);

  const handleBucketChange = (bucket: string) => {
    setSelectedBucket(bucket);
    setCurrentBucket(bucket);
    setCurrentFolder('');
    setSelectedFile(null);
    setIsPanelOpen(false);
    setSearchQuery('');
  };

  const handleSelectFolder = (folderId: string) => {
    setCurrentFolder(folderId);
    setSelectedFile(null);
    setIsPanelOpen(false);
  };

  const handleCreateFolder = async () => {
    const folderName = prompt(t('explorer:newFolderPrompt'));
    if (folderName) {
      try {
        const path = currentFolder ? `${currentFolder}${folderName}/` : `${folderName}/`;
        await api.createFolder(path);
        loadData();
      } catch (err) {
        alert(t('error.createFolder'));
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
      alert(t('error.upload'));
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
      alert(t('error.upload'));
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
      alert(t('success.metadataUpdated'));
      loadData();
    } catch (err) {
      alert(t('error.update'));
    }
  };

  const handleRenameFile = async (id: string, newName: string) => {
    try {
      await api.renameFile(id, newName);
      setIsPanelOpen(false);
      setSelectedFile(null);
      loadData();
    } catch (err) {
      alert(t('error.rename'));
    }
  };

  const handleDownloadFile = (id: string) => {
    window.open(api.getDownloadUrl(id), '_blank');
  };

  const handleDeleteFile = async (id: string) => {
    if (window.confirm(t('explorer:confirmDelete'))) {
      try {
        await api.deleteFile(id);
        setIsPanelOpen(false);
        setSelectedFile(null);
        loadData();
      } catch (err) {
        alert(t('error.delete'));
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
      alert(t('error.move'));
    }
  };

  const handleAnalyzeAll = async () => {
    try {
      setAnalyzeProgress({ state: 'preparing' });
      batchBucketRef.current = selectedBucket;
      const { batchName } = await api.startAnalyzeAll();
      batchNameRef.current = batchName;
      setAnalyzeProgress({ state: 'starting' });
    } catch (err) {
      setAnalyzeProgress(null);
      alert(t('error.analysis'));
    }
  };

  useEffect(() => {
    if (!batchNameRef.current) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getAnalyzeAllStatus(batchNameRef.current!, batchBucketRef.current);
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
          alert(t('error.batchFailed'));
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
  }, [analyzeProgress, loadData, t]);

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
        onNavigate={handleSelectFolder}
        appName={appName}
        appLogo={appLogo}
      />

      <Routes>
        <Route path="/" element={
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
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
                onAnalyzeAll={handleAnalyzeAll}
                analyzeProgress={analyzeProgress}
                bucketNames={bucketNames}
                selectedBucket={selectedBucket}
                onBucketChange={handleBucketChange}
                projectId={projectId}
                onRefresh={loadData}
                totalFileCount={allFiles.length}
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
        } />
        <Route path="/insights" element={
          <div className="main-content scrollable">
            <InsightsPanel files={allFiles} bucketNames={bucketNames} selectedBucket={selectedBucket} onBucketChange={handleBucketChange} projectId={projectId} />
          </div>
        } />
        <Route path="/index" element={
          <div className="main-content scrollable">
            <SearchPanel bucketNames={bucketNames} selectedBucket={selectedBucket} onBucketChange={handleBucketChange} projectId={projectId} />
          </div>
        } />
        <Route path="/search" element={
          <div className="main-content scrollable">
            <AnswerPanel projectId={projectId} />
          </div>
        } />
        <Route path="/admin" element={
          <div className="main-content scrollable">
            <AdminPanel folders={folders} onDataChanged={loadData} bucketNames={bucketNames} selectedBucket={selectedBucket} onBucketChange={handleBucketChange} projectId={projectId} />
          </div>
        } />
      </Routes>
    </div>
  );
}

export default App;
