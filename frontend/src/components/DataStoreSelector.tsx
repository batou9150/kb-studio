import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader, ExternalLink } from 'lucide-react';

export interface DataStoreOption {
  dataStoreId: string;
  displayName: string;
  location: string;
  engine: { engineId: string; displayName: string; solutionType: string; searchTier: string; searchAddOns: string[] } | null;
}

interface DataStoreSelectorProps {
  dataStores: DataStoreOption[];
  loading: boolean;
  selectedKey: string;
  onChange: (value: string) => void;
  showCreateOption?: boolean;
  consoleUrl?: string | null;
}

export const DataStoreSelector: React.FC<DataStoreSelectorProps> = ({
  dataStores, loading, selectedKey, onChange, showCreateOption, consoleUrl,
}) => {
  const { t } = useTranslation('search');
  const tc = useTranslation('common').t;

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="form-group" style={{ flex: 1, minWidth: 250, marginBottom: 0 }}>
        <label>{t('datastore')}</label>
        {loading ? (
          <div className="form-control" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
            <Loader size={14} className="spinner" /> {tc('loading')}
          </div>
        ) : (
          <select
            className="form-control"
            value={selectedKey}
            onChange={e => onChange(e.target.value)}
          >
            <option value="" disabled>{t('selectDatastore')}</option>
            {dataStores.map(ds => (
              <option key={`${ds.location}/${ds.dataStoreId}`} value={`${ds.location}/${ds.dataStoreId}`}>
                {ds.displayName} ({ds.location}) — {ds.dataStoreId}
              </option>
            ))}
            {showCreateOption && (
              <option value="__new__">{t('createNew')}</option>
            )}
          </select>
        )}
      </div>
      {consoleUrl && (
        <a
          className="icon-btn"
          href={consoleUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t('viewInConsole')}
          style={{ marginBottom: 4 }}
        >
          <ExternalLink size={18} />
        </a>
      )}
    </div>
  );
};
