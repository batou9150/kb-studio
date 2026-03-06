import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { api } from '../api';
import type { AnswerQueryResponse } from '../types';
import { Loader, SendHorizontal, ExternalLink } from 'lucide-react';
import { DataStoreSelector } from './DataStoreSelector';
import { useDataStores } from '../hooks/useDataStores';

interface AnswerPanelProps {
  projectId: string;
}

export const AnswerPanel: React.FC<AnswerPanelProps> = ({ projectId }) => {
  const { t } = useTranslation('answer');
  const ds = useDataStores('kb-studio-answer-datastore');

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerQueryResponse | null>(null);

  // Find selected datastore to check engine capabilities
  const selectedDs = ds.dataStores.find(d => d.dataStoreId === ds.dataStoreId && d.location === ds.location);
  const engine = selectedDs?.engine ?? null;

  const handleSelectChange = (value: string) => {
    ds.selectDataStore(value);
  };

  const handleSubmit = async () => {
    if (!ds.dataStoreId || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const hasLlm = engine?.searchAddOns?.includes('llm') ?? false;
      const res = hasLlm
        ? await api.answerQuery(ds.dataStoreId, ds.location, query.trim())
        : await api.searchQuery(ds.dataStoreId, ds.location, query.trim());
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

  const consoleUrl = ds.dataStoreId && projectId
    ? `https://console.cloud.google.com/gen-app-builder/locations/${ds.location}/collections/default_collection/data-stores/${ds.dataStoreId}/data/activities?project=${projectId}`
    : null;

  return (
    <div className="answer-panel">
      {/* Datastore selector */}
      <div className="vais-section">
        <div className="vais-section-header">
          <h2>{t('search')}</h2>
        </div>

        <div style={{ marginBottom: 16 }}>
          <DataStoreSelector
            dataStores={ds.dataStores}
            loading={ds.loading}
            selectedKey={ds.selectedKey}
            onChange={handleSelectChange}
            consoleUrl={consoleUrl}
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
            disabled={!ds.dataStoreId || !query.trim() || loading}
            style={{ marginBottom: 4 }}
          >
            {loading ? <Loader size={20} className="spinner" /> : <SendHorizontal size={20} />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="error-banner">{error}</div>}

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
