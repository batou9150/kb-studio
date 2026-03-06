import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { api } from '../api';
import type { AnswerQueryResponse } from '../types';
import { Loader, SendHorizontal, ExternalLink } from 'lucide-react';
import { DataStoreSelector } from './DataStoreSelector';
import type { DataStoreOption } from './DataStoreSelector';

const STORAGE_KEY = 'kb-studio-answer-datastore';

interface EngineInfo {
  engineId: string;
  displayName: string;
  solutionType: string;
  searchTier: string;
  searchAddOns: string[];
}

interface AnswerPanelProps {
  projectId: string;
}

export const AnswerPanel: React.FC<AnswerPanelProps> = ({ projectId }) => {
  const { t } = useTranslation('answer');
  const [dataStores, setDataStores] = useState<DataStoreOption[]>([]);
  const [dataStoresLoading, setDataStoresLoading] = useState(true);
  const [dataStoreId, setDataStoreId] = useState('');
  const [location, setLocation] = useState('global');
  const [engine, setEngine] = useState<EngineInfo | null>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerQueryResponse | null>(null);

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

  useEffect(() => {
    fetchDataStores().then(list => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && list.length > 0) {
        try {
          const { dataStoreId: savedId, location: savedLoc } = JSON.parse(saved);
          const match = list.find(ds => ds.dataStoreId === savedId && ds.location === savedLoc);
          if (match) {
            setDataStoreId(savedId);
            setLocation(savedLoc);
            setEngine(match.engine);
          }
        } catch {}
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dataStoreId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dataStoreId, location }));
    }
  }, [dataStoreId, location]);

  const handleSelectChange = (value: string) => {
    const ds = dataStores.find(d => `${d.location}/${d.dataStoreId}` === value);
    if (ds) {
      setDataStoreId(ds.dataStoreId);
      setLocation(ds.location);
      setEngine(ds.engine);
    }
  };

  const handleSubmit = async () => {
    if (!dataStoreId || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const hasLlm = engine?.searchAddOns?.includes('llm') ?? false;
      const res = hasLlm
        ? await api.answerQuery(dataStoreId, location, query.trim())
        : await api.searchQuery(dataStoreId, location, query.trim());
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectedKey = dataStoreId ? `${location}/${dataStoreId}` : '';

  return (
    <div className="answer-panel">
      {/* Datastore selector */}
      <div className="vais-section">
        <div className="vais-section-header">
          <h2>{t('search')}</h2>
        </div>

        <div style={{ marginBottom: 16 }}>
          <DataStoreSelector
            dataStores={dataStores}
            loading={dataStoresLoading}
            selectedKey={selectedKey}
            onChange={handleSelectChange}
            consoleUrl={dataStoreId && projectId ? `https://console.cloud.google.com/gen-app-builder/locations/${location}/collections/default_collection/data-stores/${dataStoreId}/data/activities?project=${projectId}` : null}
          />
        </div>

        {/* Query input */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>{t('prompt')}</label>
            <textarea
              className="form-control"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('promptPlaceholder')}
              rows={2}
              style={{ minHeight: 60 }}
            />
          </div>
          <button
            className="icon-btn primary"
            title={t('send')}
            onClick={handleSubmit}
            disabled={!dataStoreId || !query.trim() || loading}
            style={{ marginBottom: 4 }}
          >
            {loading ? <Loader size={20} className="spinner" /> : <SendHorizontal size={20} />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid var(--danger-color)', borderRadius: 6, marginBottom: 24, color: 'var(--danger-color)', fontSize: '0.9rem', maxWidth: 1000, marginLeft: 'auto', marginRight: 'auto' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading">
          <Loader size={20} className="spinner" /> {t('searching')}
        </div>
      )}

      {/* Answer */}
      {result && !loading && (
        <div className="vais-section">
          {result.answerText && (
            <div className="answer-text">
              <Markdown>{result.answerText}</Markdown>
            </div>
          )}

          {result.searchResults.length > 0 && (
            <div className="answer-results">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>{t('sources')}</h3>
              {result.searchResults.map((sr, i) => {
                const linkUrl = sr.uri?.startsWith('gs://')
                  ? `https://storage.cloud.google.com/${sr.uri.slice(5)}`
                  : sr.uri;
                return (
                <div key={i} className="answer-result-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sr.title || sr.document}</span>
                    {linkUrl && (
                      <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center' }}>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  {sr.snippets.map((snippet, j) => (
                    <p key={j} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: snippet }} />
                  ))}
                </div>
                );
              })}
            </div>
          )}

          {!result.answerText && result.searchResults.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('noResults')}</p>
          )}
        </div>
      )}
    </div>
  );
};
