import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { DataStoreStatus, DataStoreDocument, ImportOperationStatus, ImportHistoryEntry } from '../types';
import { Loader, AlertTriangle, CheckCircle, XCircle, RefreshCw, BrushCleaning, Trash2, Upload, Plus, ExternalLink, ChevronDown, ChevronRight, Clock, Eye, X } from 'lucide-react';

const STORAGE_KEY = 'kb-studio-search-selected';

interface DataStoreOption {
  dataStoreId: string;
  displayName: string;
  location: string;
}

export const SearchPanel: React.FC = () => {
  // Datastore list
  const [dataStores, setDataStores] = useState<DataStoreOption[]>([]);
  const [dataStoresLoading, setDataStoresLoading] = useState(true);

  // Selected datastore
  const [dataStoreId, setDataStoreId] = useState('');
  const [location, setLocation] = useState('global');

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newId, setNewId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newLocation, setNewLocation] = useState('global');

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [defaultParser, setDefaultParser] = useState<'digital' | 'ocr' | 'layout'>('digital');
  const [ocrUseNativeText, setOcrUseNativeText] = useState(true);
  const [layoutEnableTableAnnotation, setLayoutEnableTableAnnotation] = useState(false);
  const [layoutEnableImageAnnotation, setLayoutEnableImageAnnotation] = useState(false);
  const [enableChunking, setEnableChunking] = useState(false);
  const [chunkSize, setChunkSize] = useState(500);
  const [includeAncestorHeadings, setIncludeAncestorHeadings] = useState(false);

  const [status, setStatus] = useState<DataStoreStatus | null>(null);
  const [documents, setDocuments] = useState<DataStoreDocument[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const [importOperation, setImportOperation] = useState<{ name: string; location: string } | null>(null);
  const [importProgress, setImportProgress] = useState<ImportOperationStatus | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState<DataStoreDocument | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDataStores = useCallback(async () => {
    setDataStoresLoading(true);
    try {
      const list = await api.listDataStores();
      setDataStores(list);
      return list;
    } catch {
      setDataStores([]);
      return [];
    } finally {
      setDataStoresLoading(false);
    }
  }, []);

  // Load datastore list + restore last selection
  useEffect(() => {
    fetchDataStores().then(list => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && list.length > 0) {
        try {
          const { dataStoreId: savedId, location: savedLoc } = JSON.parse(saved);
          if (list.some(ds => ds.dataStoreId === savedId && ds.location === savedLoc)) {
            setDataStoreId(savedId);
            setLocation(savedLoc);
            return;
          }
        } catch {}
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist selection
  useEffect(() => {
    if (dataStoreId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dataStoreId, location }));
    }
  }, [dataStoreId, location]);

  const fetchStatus = useCallback(async () => {
    if (!dataStoreId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await api.getDataStoreStatus(dataStoreId, location);
      setStatus(s);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [dataStoreId, location]);

  const fetchDocuments = useCallback(async (append = false) => {
    if (!dataStoreId) return;
    try {
      const token = append ? nextPageToken : undefined;
      const res = await api.listDataStoreDocuments(dataStoreId, location, 20, token ?? undefined);
      setDocuments(prev => append ? [...prev, ...res.documents] : res.documents);
      setNextPageToken(res.nextPageToken);
    } catch {}
  }, [dataStoreId, location, nextPageToken]);

  const fetchImportHistory = useCallback(async () => {
    if (!dataStoreId) return;
    try {
      const history = await api.listImportOperations(dataStoreId, location);
      setImportHistory(history);

      // If the most recent import is still running, start polling it
      const latest = history[0];
      if (latest && !latest.done && !importOperation) {
        setImportOperation({ name: latest.name, location });
        setActionLoading('import-poll');
      }
    } catch {
      setImportHistory([]);
    }
  }, [dataStoreId, location, importOperation]);

  // Poll import operation progress
  useEffect(() => {
    if (!importOperation) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await api.getImportOperationStatus(importOperation.name, importOperation.location);
        if (cancelled) return;
        setImportProgress(status);
        if (status.done) {
          setImportOperation(null);
          setActionLoading(null);
          if (status.error) {
            setError(status.error);
          }
          fetchStatus();
          fetchDocuments();
          fetchImportHistory();
        }
      } catch {
        if (cancelled) return;
      }
    };
    poll(); // immediate first poll
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [importOperation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch when selection changes
  useEffect(() => {
    if (dataStoreId) {
      setStatus(null);
      setDocuments([]);
      setNextPageToken(null);
      setImportHistory([]);
      fetchStatus();
      fetchDocuments();
      fetchImportHistory();
    }
  }, [dataStoreId, location]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectChange = (value: string) => {
    if (value === '__new__') {
      setShowCreateForm(true);
      return;
    }
    setShowCreateForm(false);
    const ds = dataStores.find(d => `${d.location}/${d.dataStoreId}` === value);
    if (ds) {
      setDataStoreId(ds.dataStoreId);
      setLocation(ds.location);
    }
  };

  const handleCreate = async () => {
    if (!newId || !newDisplayName) return;
    setActionLoading('create');
    setError(null);
    try {
      // Build documentProcessingConfig from advanced options
      let documentProcessingConfig: any = undefined;
      const hasParserConfig = defaultParser !== 'digital';
      const hasChunkingConfig = enableChunking;
      if (hasParserConfig || hasChunkingConfig) {
        documentProcessingConfig = {};
        if (defaultParser === 'ocr') {
          documentProcessingConfig.defaultParsingConfig = {
            ocrParsingConfig: { useNativeText: ocrUseNativeText },
          };
        } else if (defaultParser === 'layout') {
          documentProcessingConfig.defaultParsingConfig = {
            layoutParsingConfig: {
              enableTableAnnotation: layoutEnableTableAnnotation,
              enableImageAnnotation: layoutEnableImageAnnotation,
            },
          };
        }
        if (hasChunkingConfig) {
          documentProcessingConfig.chunkingConfig = {
            layoutBasedChunkingConfig: {
              chunkSize,
              includeAncestorHeadings,
            },
          };
        }
      }
      await api.createDataStore(newId, newDisplayName, newLocation, documentProcessingConfig);
      await fetchDataStores();
      setDataStoreId(newId);
      setLocation(newLocation);
      setShowCreateForm(false);
      setNewId('');
      setNewDisplayName('');
      setShowAdvanced(false);
      setDefaultParser('digital');
      setOcrUseNativeText(true);
      setLayoutEnableTableAnnotation(false);
      setLayoutEnableImageAnnotation(false);
      setEnableChunking(false);
      setChunkSize(500);
      setIncludeAncestorHeadings(false);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleImport = async (mode: 'INCREMENTAL' | 'FULL') => {
    setActionLoading(`import-${mode}`);
    setError(null);
    setImportProgress(null);
    try {
      const { operationName } = await api.importDocuments(dataStoreId, location, mode);
      setImportOperation({ name: operationName, location });
      setStatus(prev => prev ? { ...prev, lastImportDone: false } : prev);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setActionLoading(null);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm('Purger tous les documents du datastore ?')) return;
    if (!window.confirm('Cette action est irréversible. Confirmer la purge ?')) return;
    setActionLoading('purge');
    setError(null);
    try {
      await api.purgeDocuments(dataStoreId, location);
      await fetchStatus();
      setDocuments([]);
      setNextPageToken(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDataStore = async () => {
    if (!window.confirm(`Supprimer le datastore "${dataStoreId}" et son application associée ?`)) return;
    if (!window.confirm('Cette action est irréversible. Confirmer la suppression ?')) return;
    setActionLoading('delete');
    setError(null);
    try {
      await api.deleteDataStore(dataStoreId, location);
      setDataStoreId('');
      setLocation('global');
      setStatus(null);
      setDocuments([]);
      setNextPageToken(null);
      setImportHistory([]);
      localStorage.removeItem(STORAGE_KEY);
      await fetchDataStores();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const isActionLoading = actionLoading !== null;
  const selectedKey = dataStoreId ? `${location}/${dataStoreId}` : '';

  return (
    <div className="vais-panel">
      {/* Datastore selection */}
      <div className="vais-section">
        <div className="vais-section-header">
          <h2>Datastore</h2>
          {status?.consoleUrl && !showCreateForm && (
            <a className="btn btn-outline" href={status.consoleUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
              <ExternalLink size={14} /> Voir dans la Console
            </a>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 250, marginBottom: 0 }}>
            <label>Datastore</label>
            {dataStoresLoading ? (
              <div className="form-control" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                <Loader size={14} className="spinner" /> Chargement...
              </div>
            ) : (
              <select
                className="form-control"
                value={showCreateForm ? '__new__' : selectedKey}
                onChange={e => handleSelectChange(e.target.value)}
              >
                <option value="" disabled>Sélectionner un datastore...</option>
                {dataStores.map(ds => (
                  <option key={`${ds.location}/${ds.dataStoreId}`} value={`${ds.location}/${ds.dataStoreId}`}>
                    {ds.displayName} ({ds.location}) — {ds.dataStoreId}
                  </option>
                ))}
                <option value="__new__">+ Créer un nouveau datastore</option>
              </select>
            )}
          </div>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div style={{ marginTop: 16, padding: 16, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-color)' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                <label>Nom du Datastore</label>
                <input className="form-control" value={newDisplayName} onChange={e => {
                  setNewDisplayName(e.target.value);
                  setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '_' + Date.now());
                }} placeholder="Ma Base de Connaissances" />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                <label>ID du Datastore</label>
                <input className="form-control" value={newId} onChange={e => setNewId(e.target.value)} placeholder="my-kb-datastore" />
              </div>
              <div className="form-group" style={{ minWidth: 120, marginBottom: 0 }}>
                <label>Région</label>
                <select className="form-control" value={newLocation} onChange={e => setNewLocation(e.target.value)}>
                  <option value="global">Global</option>
                  <option value="eu">EU</option>
                  <option value="us">US</option>
                </select>
              </div>
            </div>
            {/* Advanced options toggle */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Options avancées
            </div>

            {showAdvanced && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
                {/* Parsing config */}
                <fieldset style={{ flex: 1, minWidth: 220, border: '1px solid var(--border-color)', borderRadius: 6, padding: '12px 16px' }}>
                  <legend style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 4px' }}>Parsing par défaut</legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" name="parser" checked={defaultParser === 'digital'} onChange={() => setDefaultParser('digital')} /> Digital
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" name="parser" checked={defaultParser === 'ocr'} onChange={() => setDefaultParser('ocr')} /> OCR
                    </label>
                    {defaultParser === 'ocr' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 20 }}>
                        <input type="checkbox" checked={ocrUseNativeText} onChange={e => setOcrUseNativeText(e.target.checked)} />
                        Utiliser le texte natif si disponible
                      </label>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" name="parser" checked={defaultParser === 'layout'} onChange={() => setDefaultParser('layout')} /> Layout
                    </label>
                    {defaultParser === 'layout' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 20 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={layoutEnableTableAnnotation} onChange={e => setLayoutEnableTableAnnotation(e.target.checked)} />
                          Annotation des tableaux
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={layoutEnableImageAnnotation} onChange={e => setLayoutEnableImageAnnotation(e.target.checked)} />
                          Annotation des images
                        </label>
                      </div>
                    )}
                  </div>
                </fieldset>

                {/* Chunking config */}
                <fieldset style={{ flex: 1, minWidth: 220, border: '1px solid var(--border-color)', borderRadius: 6, padding: '12px 16px' }}>
                  <legend style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 4px' }}>Chunking (RAG)</legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={enableChunking} onChange={e => setEnableChunking(e.target.checked)} />
                      Activer la configuration avancée de chunking
                    </label>
                    {enableChunking && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 20 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.85rem' }}>Taille des chunks</label>
                          <input
                            type="number"
                            className="form-control"
                            min={100}
                            max={500}
                            value={chunkSize}
                            onChange={e => setChunkSize(Math.min(500, Math.max(100, Number(e.target.value))))}
                            style={{ width: 120 }}
                          />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={includeAncestorHeadings} onChange={e => setIncludeAncestorHeadings(e.target.checked)} />
                          Inclure les titres parents
                        </label>
                      </div>
                    )}
                  </div>
                </fieldset>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newId || !newDisplayName || isActionLoading}>
                {actionLoading === 'create' ? <Loader size={16} className="spinner" /> : <Plus size={16} />}
                Créer
              </button>
              <button className="btn btn-outline" onClick={() => setShowCreateForm(false)}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid var(--danger-color)', borderRadius: 6, marginBottom: 24, color: 'var(--danger-color)', fontSize: '0.9rem', maxWidth: 1000, marginLeft: 'auto', marginRight: 'auto' }}>
          {error}
        </div>
      )}

      {/* Status */}
      {dataStoreId && (
        <div className="vais-section">
          <div className="vais-section-header">
            <h2>Statut</h2>
            <button className="icon-btn" title="Rafraîchir" onClick={fetchStatus} disabled={loading}>
              <RefreshCw size={18} className={loading ? 'spinner' : ''} />
            </button>
          </div>

          {loading && !status ? (
            <div className="loading"><Loader size={20} className="spinner" /> Chargement...</div>
          ) : status ? (
            <table className="file-table">
              <tbody>
                <tr><td style={{ fontWeight: 600 }}>Documents dans le datastore</td><td>{status.documentCount}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Entrées dans kb.ndjson</td><td>{status.kbEntryCount}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>kb.ndjson modifié le</td><td>{status.kbNdjsonUpdatedAt ? new Date(status.kbNdjsonUpdatedAt).toLocaleString() : '—'}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Dernier import</td><td>{status.lastImportTime ? new Date(status.lastImportTime).toLocaleString() : '—'}</td></tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Synchronisation</td>
                  <td>
                    {!status.lastImportDone ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary-color)', fontWeight: 500 }}>
                        <Loader size={16} className="spinner" /> Import en cours
                      </span>
                    ) : status.lastImportFailureCount > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--danger-color)', fontWeight: 500 }}>
                        <XCircle size={16} /> {status.lastImportFailureCount} document{status.lastImportFailureCount > 1 ? 's' : ''} en erreur{status.lastImportFailureCount > 1 ? 's' : ''} à corriger
                      </span>
                    ) : status.isUpToDate ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--success-color)', fontWeight: 500 }}>
                        <CheckCircle size={16} /> À jour
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--warning-color)', fontWeight: 500 }}>
                        <AlertTriangle size={16} /> Nécessite un ré-import
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}
        </div>
      )}

      {/* Import */}
      {status?.exists && (
        <div className="vais-section">
          <div className="vais-section-header">
            <h2>Import</h2>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => handleImport('INCREMENTAL')} disabled={isActionLoading}>
              {actionLoading === 'import-INCREMENTAL' ? <Loader size={16} className="spinner" /> : <Upload size={16} />}
              Import (Incrémental)
            </button>
            <button className="btn btn-outline" onClick={() => handleImport('FULL')} disabled={isActionLoading}>
              {actionLoading === 'import-FULL' ? <Loader size={16} className="spinner" /> : <Upload size={16} />}
              Import (Full)
            </button>
          </div>
          {importOperation && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg-secondary, #f8f9fa)', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: importProgress && importProgress.totalCount > 0 ? 8 : 0 }}>
                <Loader size={14} className="spinner" />
                <span style={{ fontWeight: 500 }}>Import en cours...</span>
              </div>
              {importProgress && importProgress.totalCount > 0 && (
                <div style={{ display: 'flex', gap: 16, color: 'var(--text-secondary)' }}>
                  <span>Traités {importProgress.successCount + importProgress.failureCount}/{importProgress.totalCount}</span>
                  <span style={{ color: 'var(--success-color)' }}>Succès {importProgress.successCount}</span>
                  {importProgress.failureCount > 0 && (
                    <span style={{ color: 'var(--danger-color)' }}>Échecs {importProgress.failureCount}</span>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Import history */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Clock size={14} />
              Historique des imports
            </div>
            {showHistory && (
              <div style={{ marginTop: 8 }}>
                {importHistory.length > 0 ? (
                  <table className="file-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Statut</th>
                        <th>Succès</th>
                        <th>Échecs</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importHistory.map(op => (
                        <tr key={op.name}>
                          <td style={{ whiteSpace: 'nowrap' }}>{op.createTime ? new Date(op.createTime).toLocaleString() : '—'}</td>
                          <td>
                            {!op.done ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary-color)' }}>
                                <Loader size={12} className="spinner" /> En cours
                              </span>
                            ) : op.error ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger-color)' }}>
                                <XCircle size={12} /> Erreur
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success-color)' }}>
                                <CheckCircle size={12} /> Terminé
                              </span>
                            )}
                          </td>
                          <td>{op.successCount}</td>
                          <td>{op.failureCount > 0 ? <span style={{ color: 'var(--danger-color)' }}>{op.failureCount}</span> : op.failureCount}</td>
                          <td>{op.totalCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>Aucun import précédent.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents */}
      {status?.exists && (
        <div className="vais-section">
          <div className="vais-section-header">
            <h2>Documents ({status.documentCount})</h2>
            <button className="icon-btn" title="Rafraîchir" onClick={() => fetchDocuments()}>
              <RefreshCw size={18} />
            </button>
          </div>

          {documents.length > 0 ? (
            <>
              <table className="file-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>URI</th>
                    <th>Statut indexation</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => {
                    const gcsUrl = doc.uri.startsWith('gs://')
                      ? `https://storage.cloud.google.com/${doc.uri.slice(5)}`
                      : doc.uri;
                    return (
                      <tr key={doc.id}>
                        <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.id}</td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <a href={gcsUrl} target="_blank" rel="noopener noreferrer" title={doc.uri}>
                            {doc.uri}
                          </a>
                        </td>
                        <td>
                          {doc.indexState === 'indexed' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success-color)' }}>
                              <CheckCircle size={14} /> Indexé
                            </span>
                          ) : doc.indexState === 'error' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger-color)' }}>
                              <XCircle size={14} /> Erreur
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warning-color)' }} title={doc.indexPendingMessage || undefined}>
                              <Loader size={14} className="spinner" /> En attente
                            </span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setSelectedDoc(doc)}>
                            <Eye size={14} /> Voir le document
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {nextPageToken && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <button className="btn btn-outline" onClick={() => fetchDocuments(true)}>Charger plus</button>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Aucun document dans le datastore.</p>
          )}
        </div>
      )}

      {/* Danger zone */}
      {status?.exists && (
        <div className="danger-zone">
          <div className="danger-zone-header">
            <AlertTriangle size={20} />
            <h3>Zone dangereuse</h3>
          </div>
          <p>Ces actions sont irréversibles. Les fichiers dans GCS ne sont pas affectés.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-danger" onClick={handlePurge} disabled={isActionLoading}>
              {actionLoading === 'purge' ? <Loader size={16} className="spinner" /> : <BrushCleaning size={16} />}
              {actionLoading === 'purge' ? 'Purge en cours...' : 'Purger tous les documents'}
            </button>
            <button className="btn btn-danger" onClick={handleDeleteDataStore} disabled={isActionLoading}>
              {actionLoading === 'delete' ? <Loader size={16} className="spinner" /> : <Trash2 size={16} />}
              {actionLoading === 'delete' ? 'Suppression en cours...' : 'Supprimer le datastore'}
            </button>
          </div>
        </div>
      )}

      {/* Document detail modal */}
      {selectedDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedDoc(null)}>
          <div style={{ background: 'var(--bg-color, #fff)', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Document {selectedDoc.id}</h3>
              <button className="icon-btn" onClick={() => setSelectedDoc(null)}><X size={18} /></button>
            </div>
            <pre style={{ background: 'var(--bg-secondary, #f8f9fa)', padding: 16, borderRadius: 6, overflow: 'auto', fontSize: '0.85rem', margin: 0 }}>
              {JSON.stringify(selectedDoc.structData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
