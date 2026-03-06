import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { FolderPlus, Pencil, Trash2, AlertTriangle, Loader, History, Eye } from 'lucide-react';
import { BucketSelector } from './BucketSelector';

interface BatchInfo {
  name: string;
  state: string;
  displayName: string;
  createTime: string;
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
              gcsConsoleTitle={t('viewInConsole')}
            />
          </h2>
          <button className="btn btn-primary" onClick={handleCreateFolder} disabled={loading}>
            <FolderPlus size={16} /> {t('newFolder')}
          </button>
        </div>

        <table className="file-table">
          <thead>
            <tr>
              <th>{t('colFolder')}</th>
              <th style={{ width: 120 }}>{t('colActions')}</th>
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
              <th>{t('colName')}</th>
              <th>{t('colState')}</th>
              <th>{t('colDate')}</th>
              <th style={{ width: 140 }}>{t('colActions')}</th>
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
                    <td><span className={`batch-state-badge batch-state-${batch.state}`}>{batch.state}</span></td>
                    <td>{formatDate(batch.createTime)}</td>
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
                        <p style={{ marginBottom: 8 }}>
                          <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{expandedBatch.data.results.length} {t('success')}</span>
                          {' / '}
                          <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{expandedBatch.data.failed.length} {t('failures')}</span>
                        </p>

                        {expandedBatch.data.results.length > 0 && (
                          <details>
                            <summary style={{ fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>{t('successDetails', { count: expandedBatch.data.results.length })}</summary>
                            <table className="analyze-results-table">
                              <thead>
                                <tr>
                                  <th>{t('colDescription')}</th>
                                  <th>{t('colDate')}</th>
                                  <th>{t('colCategory')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expandedBatch.data.results.map((r) => (
                                  <tr key={r.id}>
                                    <td>{r.description}</td>
                                    <td>{r.value_date}</td>
                                    <td>{r.category}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        )}

                        {expandedBatch.data.failed.length > 0 && (
                          <details>
                            <summary style={{ fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>{t('failureDetails', { count: expandedBatch.data.failed.length })}</summary>
                            <table className="analyze-results-table">
                              <thead>
                                <tr>
                                  <th>{t('colId')}</th>
                                  <th>{t('colError')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expandedBatch.data.failed.map((f) => (
                                  <tr key={f.id}>
                                    <td title={f.id}>{f.id.length > 12 ? f.id.slice(0, 12) + '…' : f.id}</td>
                                    <td>{f.error}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        )}
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
