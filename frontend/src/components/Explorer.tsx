import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import type { FileItem } from '../types';
import { FileText, Image, File as FileIcon, Trash2, Download, FolderPlus, ArrowUpFromLine, FileUp, FolderUp, Folder, Pencil, Check, X, Search, ChevronDown, Upload, Eye, Sparkles, Loader, Terminal, Copy, CheckCheck, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import { BucketSelector } from './BucketSelector';
import { format } from 'date-fns';

interface ExplorerProps {
  files: FileItem[];
  selectedFile: FileItem | null;
  onSelectFile: (file: FileItem) => void;
  onUpload: (files: File[]) => void;
  onDeleteFile: (id: string) => void;
  onDownloadFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  onSearch: (query: string) => void;
  onAnalyzeAll: () => void;
  analyzeProgress: { state: 'preparing' } | { state: 'starting' } | { state: 'running'; done: number; total: number } | null;
  bucketNames: string[];
  selectedBucket: string;
  onBucketChange: (bucket: string) => void;
  projectId: string;
  onRefresh: () => void;
  totalFileCount: number;
  sidebar?: React.ReactNode;
  detailsPanel?: React.ReactNode;
}

export const Explorer: React.FC<ExplorerProps> = ({
  files, selectedFile, onSelectFile, onUpload, onDeleteFile, onDownloadFile, onRenameFile, onSearch, onAnalyzeAll, analyzeProgress, bucketNames, selectedBucket, onBucketChange, projectId, onRefresh, totalFileCount, sidebar, detailsPanel
}) => {
  const { t } = useTranslation('explorer');
  const tc = useTranslation('common').t;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [internalDrag, setInternalDrag] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [cliModal, setCliModal] = useState<'gcloud' | 'gsutil' | null>(null);
  const [copied, setCopied] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    onUpload(acceptedFiles);
  }, [onUpload]);

  const startEditing = (file: FileItem) => {
    setEditingId(file.id);
    setEditingName(file.name);
  };

  const confirmEditing = (file: FileItem) => {
    if (editingName && editingName !== file.name) {
      onRenameFile(file.id, editingName);
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

  const getCliCommand = (tool: 'gcloud' | 'gsutil') => {
    if (tool === 'gcloud') {
      return `gcloud storage cp -r ./* gs://${selectedBucket}/`;
    }
    return `gsutil -m cp -r ./* gs://${selectedBucket}/`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <Image size={18} color="var(--primary-color)" />;
    if (contentType === 'application/pdf') return <FileText size={18} color="#ef4444" />;
    return <FileIcon size={18} color="var(--text-secondary)" />;
  };

  return (
    <div className="explorer" {...getRootProps()}>
      <input {...getInputProps()} />

      <div className="explorer-toolbar">
        <div className="explorer-toolbar-left">
          <BucketSelector
            bucketNames={bucketNames}
            selectedBucket={selectedBucket}
            onBucketChange={onBucketChange}
            projectId={projectId}
            gcsConsoleTitle={tc('viewInConsole')}
          />
          <span className="file-count">{totalFileCount} files</span>
        </div>
        <div className="explorer-toolbar-center">
          <div className="search-bar">
            <Search size={18} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="explorer-toolbar-right">
          <button
            className="btn btn-outline"
            onClick={onAnalyzeAll}
            disabled={analyzeProgress !== null || files.length === 0}
            title={t('analyzeAllTooltip')}
          >
            {analyzeProgress ? <Loader size={16} className="spinner" /> : <Sparkles size={16} />}
            {analyzeProgress?.state === 'preparing' ? t('analyzePreparing')
              : analyzeProgress?.state === 'starting' ? t('analyzeStarting')
                : analyzeProgress?.state === 'running' ? t('analyzeRunning', { done: analyzeProgress.done, total: analyzeProgress.total })
                  : t('analyzeAll')}
          </button>
          <div className="upload-dropdown">
            <button className="btn btn-outline" onClick={() => setUploadMenuOpen(!uploadMenuOpen)}>
              <ArrowUpFromLine size={16} />
              {t('import')}
              <ChevronDown size={14} />
            </button>
            {uploadMenuOpen && (
              <>
                <div className="upload-dropdown-backdrop" onClick={() => setUploadMenuOpen(false)} />
                <div className="upload-dropdown-menu">
                  <button onClick={() => { setUploadMenuOpen(false); document.getElementById('file-upload')?.click(); }}>
                    <FileUp size={16} />
                    {t('importFiles')}
                  </button>
                  <button onClick={() => { setUploadMenuOpen(false); document.getElementById('folder-upload')?.click(); }}>
                    <FolderUp size={16} />
                    {t('importFolder')}
                  </button>
                  <div className="upload-dropdown-separator" />
                  <button onClick={() => { setUploadMenuOpen(false); setCliModal('gcloud'); }}>
                    <Terminal size={16} />
                    gcloud
                  </button>
                  <button onClick={() => { setUploadMenuOpen(false); setCliModal('gsutil'); }}>
                    <Terminal size={16} />
                    gsutil
                  </button>
                </div>
              </>
            )}
            <input
              id="file-upload"
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) onUpload(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            <input
              id="folder-upload"
              type="file"
              // @ts-expect-error webkitdirectory is not in the type definitions
              webkitdirectory=""
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) onUpload(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
          </div>
          <button className="icon-btn" title={tc('refresh')} onClick={onRefresh}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="explorer-body">
        {sidebar}
        <div className="explorer-content">
          {isDragActive && !internalDrag && (
            <div className="dropzone active">
              <Upload size={32} />
              <p style={{ marginTop: '12px', fontWeight: 500 }}>{t('dropFiles')}</p>
            </div>
          )}

          {!isDragActive && !internalDrag && files.length === 0 ? (
            <div className="empty-state">
              <FolderPlus size={48} />
              <h3>{t('emptyFolder')}</h3>
              <p>{t('emptyFolderHint')}</p>
            </div>
          ) : (
            <table className="file-table">
              <thead>
                <tr>
                  <th>{tc('colFolder')}</th>
                  <th>{tc('colName')}</th>
                  <th>{t('colModified')}</th>
                  <th style={{ width: '80px' }}>{tc('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr
                    key={file.id}
                    className={`file-row ${selectedFile?.id === file.id ? 'selected' : ''}`}
                    onClick={() => onSelectFile(file)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/kb-file-id', file.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setInternalDrag(true);
                    }}
                    onDragEnd={() => setInternalDrag(false)}
                  >
                    <td>
                      <div className="file-name-cell">
                        <Folder size={18} color="var(--text-secondary)" />
                        {file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '/'}
                      </div>
                    </td>
                    <td>
                      <div className="file-name-cell" onClick={(e) => editingId === file.id && e.stopPropagation()}>
                        {getFileIcon(file.contentType)}
                        {editingId === file.id ? (
                          <>
                            <input
                              className="form-control"
                              style={{ padding: '2px 8px', fontSize: '0.9rem', flex: 1 }}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmEditing(file);
                                else if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                            />
                            <button className="icon-btn" title={tc('confirm')} onClick={(e) => { e.stopPropagation(); confirmEditing(file); }}>
                              <Check size={14} />
                            </button>
                            <button className="icon-btn" title={tc('cancel')} onClick={(e) => { e.stopPropagation(); cancelEditing(); }}>
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            {file.name}
                            <button
                              className="icon-btn"
                              title={tc('rename')}
                              onClick={(e) => { e.stopPropagation(); startEditing(file); }}
                            >
                              <Pencil size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td>{format(new Date(file.updated), 'dd/MM/yyyy')}</td>
                    <td>
                      <div className="file-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" onClick={() => onSelectFile(file)} title={tc('viewMetadata')}>
                          <Eye size={16} />
                        </button>
                        <button className="icon-btn" onClick={() => onDownloadFile(file.id)} title={tc('download')}>
                          <Download size={16} />
                        </button>
                        <button className="icon-btn danger" onClick={() => onDeleteFile(file.id)} title={tc('delete')}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="file-count-bar">
            {files.length} / {totalFileCount}
          </div>
        </div>
        {detailsPanel}
      </div>

      {cliModal && (
        <Modal
          title={`${t('importWith')} ${cliModal}`}
          icon={<Terminal size={20} />}
          onClose={() => { setCliModal(null); setCopied(false); }}
          width={560}
          footer={
            <button className="btn btn-outline" onClick={() => { setCliModal(null); setCopied(false); }}>
              {tc('close')}
            </button>
          }
        >
          <p>{t('cliImportDesc')}</p>
          <div className="code-block-wrapper">
            <button
              className="icon-btn code-block-copy"
              title={tc('copy')}
              onClick={() => handleCopy(getCliCommand(cliModal))}
            >
              {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
            </button>
            <div className="code-block">
              <code>{getCliCommand(cliModal)}</code>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
