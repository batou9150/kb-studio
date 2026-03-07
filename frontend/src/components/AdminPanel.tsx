import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { FolderPlus, Pencil, Trash2, AlertTriangle, Loader, History, Eye, CheckCircle, XCircle } from 'lucide-react';
import { BucketSelector } from './BucketSelector';
import { AnalyzeResultsTable } from './AnalyzeResultsTable';
import { StatusBadge } from './StatusBadge';

interface BatchInfo {
  name: string;
  state: string;
  displayName: string;
  createTime: string;
  endTime: string;
}

interface BatchDetails {
  results: { id: string; description: string; value_date: string; category: string }[];
  failed: { id: string; error: string }[];
}

interface AdminPanelProps {
  folders: string[];
  onDataChanged: () => void;
  bucketNames: string[];
  selectedBucket: string;
  onBucketChange: (bucket: string) => void;
  projectId: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ folders, onDataChanged, bucketNames, selectedBucket, onBucketChange, projectId }) => {
  const { t, i18n } = useTranslation('admin');
  const tc = useTranslation('common').t;
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<{ name: string; data: BatchDetails } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  useEffect(() => {
    api.getAnalyzeHistory().then(setBatches).catch(() => {});
  }, []);

  const handleCreateFolder = async () => {
    const name = prompt(t('newFolderPrompt'));
    if (!name) return;
    try {
      setLoading(true);
      await api.createFolder(name + '/');
      onDataChanged();
    } catch {
      alert(tc('error.createFolder'));
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFolder = async (folder: string) => {
    const newName = prompt(t('renameFolderPrompt'), folder.replace(/\/$/, ''));
    if (!newName || newName === folder.replace(/\/$/, '')) return;
    try {
      setLoading(true);
      await api.renameFolder(folder, newName.endsWith('/') ? newName : newName + '/');
      onDataChanged();
    } catch {
      alert(tc('error.renameFolder'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (folder: string) => {
    if (!window.confirm(t('confirmDeleteFolder', { folder }))) return;
    try {
      setLoading(true);
      await api.deleteFolder(folder);
      onDataChanged();
    } catch {
      alert(tc('error.deleteFolder'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(t('confirmDeleteAll', { bucket: selectedBucket }))) return;
    if (!window.confirm(t('confirmDeleteAllIrreversible', { bucket: selectedBucket }))) return;
    try {
      setLoading(true);
      await api.deleteAllFiles();
      onDataChanged();
    } catch {
      alert(tc('error.delete'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (batch: BatchInfo) => {
    if (expandedBatch?.name === batch.name) {
      setExpandedBatch(null);
      return;
    }
    try {
      setLoadingDetails(batch.name);
      const data = await api.getAnalyzeDetails(batch.name);
      setExpandedBatch({ name: batch.name, data });
    } catch {
      alert(tc('error.loadDetails'));
    } finally {
      setLoadingDetails(null);
    }
  };

  const formatDuration = (createTime: string, updateTime: string): string | null => {
    if (!createTime || !updateTime) return null;
    const ms = new Date(updateTime).getTime() - new Date(createTime).getTime();
    if (ms < 0) return null;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}min ${remainingSeconds}s` : `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <div className="admin-section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('folderManagementFor')}
            <BucketSelector
              bucketNames={bucketNames}
              selectedBucket={selectedBucket}
              onBucketChange={onBucketChange}
              projectId={projectId}
              gcsConsoleTitle={tc('viewInConsole')}
            />
          </h2>
          <button className="btn btn-primary" onClick={handleCreateFolder} disabled={loading}>
            <FolderPlus size={16} /> {t('newFolder')}
          </button>
        </div>

        <table className="file-table">
          <thead>
            <tr>
              <th>{tc('colFolder')}</th>
              <th style={{ width: 120 }}>{tc('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {folders.length === 0 ? (
              <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t('noFolder')}</td></tr>
            ) : (
              folders.map(folder => {
                const depth = folder.split('/').filter(Boolean).length - 1;
                return (
                  <tr key={folder}>
                    <td style={{ paddingLeft: `${16 + depth * 20}px` }}>{folder}</td>
                    <td>
                      <div className="file-actions">
                        <button className="icon-btn" title={tc('rename')} onClick={() => handleRenameFolder(folder)} disabled={loading}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn danger" title={tc('delete')} onClick={() => handleDeleteFolder(folder)} disabled={loading}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h2><History size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />{t('analysisHistory')}</h2>
        </div>

        <table className="file-table">
          <thead>
            <tr>
              <th>{tc('colName')}</th>
              <th>{tc('colDate')}</th>
              <th>{t('colStatus')}</th>
              <th style={{ width: 140 }}>{tc('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t('noAnalysis')}</td></tr>
            ) : (
              batches.map(batch => (
                <React.Fragment key={batch.name}>
                  <tr>
                    <td>{batch.displayName}</td>
                    <td>{formatDate(batch.createTime)}</td>
                    <td>
                      {batch.state === 'running' ? (
                        <StatusBadge variant="primary" icon={<Loader size={12} className="spinner" />}>{t('inProgress')}</StatusBadge>
                      ) : batch.state === 'failed' ? (
                        <StatusBadge variant="danger" icon={<XCircle size={12} />}>{t('error')}</StatusBadge>
                      ) : batch.state === 'succeeded' ? (() => {
                        const duration = formatDuration(batch.createTime, batch.endTime);
                        return (
                          <StatusBadge variant="success" icon={<CheckCircle size={12} />}>
                            {duration ? t('doneIn', { duration }) : t('done')}
                          </StatusBadge>
                        );
                      })() : (
                        <StatusBadge variant="warning" icon={<AlertTriangle size={12} />}>{batch.state}</StatusBadge>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        disabled={batch.state !== 'succeeded' || loadingDetails === batch.name}
                        onClick={() => handleViewDetails(batch)}
                      >
                        {loadingDetails === batch.name ? <Loader size={14} className="spinner" /> : <Eye size={14} />}
                        {expandedBatch?.name === batch.name ? t('hideDetails') : t('viewDetails')}
                      </button>
                    </td>
                  </tr>
                  {expandedBatch?.name === batch.name && (
                    <tr className="history-detail-row">
                      <td colSpan={4}>
                        <AnalyzeResultsTable results={expandedBatch.data.results} failed={expandedBatch.data.failed} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="danger-zone">
        <div className="danger-zone-header">
          <AlertTriangle size={20} />
          <h3>{t('dangerZone')}</h3>
        </div>
        <p>{t('dangerZoneDesc')}</p>
        <button className="btn btn-danger" onClick={handleDeleteAll} disabled={loading}>
          {loading ? <Loader size={16} className="spinner" /> : <Trash2 size={16} />}
          {loading ? t('deletingAll') : t('deleteAll')}
        </button>
      </div>
    </div>
  );
};
