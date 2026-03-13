import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader, RefreshCw } from 'lucide-react';
import type { FileItem } from '../types';
import { BucketSelector } from './BucketSelector';
import { api } from '../api';

// Module-level cache: survives component unmount/remount (tab switches)
const duplicatesCache = new Map<string, { ids: string[]; reason: string }[]>();

interface InsightsPanelProps {
  files: FileItem[];
  bucketNames: string[];
  selectedBucket: string;
  onBucketChange: (bucket: string) => void;
  projectId: string;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  files,
  bucketNames,
  selectedBucket,
  onBucketChange,
  projectId,
}) => {
  const { t, i18n } = useTranslation('insights');
  const { t: tDetails } = useTranslation('details');
  const tc = useTranslation('common').t;

  const categoryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      const cat = file.metadata?.structData?.category || '';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [files]);

  const fileTypeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase() : t('noFileType');
      counts.set(ext, (counts.get(ext) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([fileType, count]) => ({ fileType, count }))
      .sort((a, b) => b.count - a.count);
  }, [files, t]);

  const cached = duplicatesCache.get(selectedBucket);
  const [duplicateGroups, setDuplicateGroups] = useState<{ ids: string[]; reason: string }[] | null>(cached ?? null);
  const [detectingDuplicates, setDetectingDuplicates] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  const fetchDuplicates = async () => {
    setDetectingDuplicates(true);
    setDuplicateError('');
    try {
      const result = await api.detectDuplicates(i18n.language);
      setDuplicateGroups(result.groups);
      duplicatesCache.set(selectedBucket, result.groups);
    } catch {
      setDuplicateError(t('detectError'));
    } finally {
      setDetectingDuplicates(false);
    }
  };

  useEffect(() => {
    if (duplicatesCache.has(selectedBucket)) {
      setDuplicateGroups(duplicatesCache.get(selectedBucket)!);
    } else if (files.length > 0) {
      fetchDuplicates();
    }
  }, [selectedBucket]);

  const getFileName = (id: string): string => {
    const file = files.find(f => f.id === id);
    return file?.name || id;
  };

  const pct = (count: number) => files.length ? `${((count / files.length) * 100).toFixed(1)}%` : '0%';

  const getCategoryLabel = (category: string): string => {
    if (!category) return t('noCategory');
    const key = `categories.${category}`;
    const translated = tDetails(key);
    return translated === key ? category : translated;
  };

  return (
    <div className="vais-panel">
      <div className="vais-section">
        <div className="vais-section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('title')}
            <BucketSelector
              bucketNames={bucketNames}
              selectedBucket={selectedBucket}
              onBucketChange={onBucketChange}
              projectId={projectId}
              gcsConsoleTitle={tc('viewInConsole')}
            />
          </h2>
        </div>
      </div>

      <div className="vais-section">
        <div className="vais-section-header">
          <h2>{t('totalFiles')}</h2>
        </div>
        <p style={{ fontSize: '2rem', fontWeight: 600, margin: '0.5rem 0' }}>{files.length}</p>
      </div>

      <div className="vais-section">
        <div className="vais-section-header">
          <h2>{t('byCategory')}</h2>
        </div>
        <table className="file-table">
          <thead>
            <tr>
              <th>{t('category')}</th>
              <th>{t('count')}</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {categoryBreakdown.map(({ category, count }) => (
              <tr key={category}>
                <td>{getCategoryLabel(category)}</td>
                <td>{count}</td>
                <td>{pct(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vais-section">
        <div className="vais-section-header">
          <h2>{t('byFileType')}</h2>
        </div>
        <table className="file-table">
          <thead>
            <tr>
              <th>{t('fileType')}</th>
              <th>{t('count')}</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {fileTypeBreakdown.map(({ fileType, count }) => (
              <tr key={fileType}>
                <td>{fileType}</td>
                <td>{count}</td>
                <td>{pct(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vais-section">
        <div className="vais-section-header">
          <h2>{t('duplicates')}</h2>
          <button className="icon-btn" title={tc('refresh')} onClick={fetchDuplicates} disabled={detectingDuplicates}>
            <RefreshCw size={18} className={detectingDuplicates ? 'spinner' : ''} />
          </button>
        </div>
        {detectingDuplicates && duplicateGroups === null && (
          <div className="loading"><Loader size={20} className="spinner" /> {tc('loading')}</div>
        )}
        {duplicateError && <p style={{ color: 'var(--color-error, #e53e3e)' }}>{duplicateError}</p>}
        {duplicateGroups !== null && duplicateGroups.length === 0 && (
          <p>{t('noDuplicates')}</p>
        )}
        {duplicateGroups !== null && duplicateGroups.length > 0 && (
          <table className="file-table">
            <thead>
              <tr>
                <th>{t('duplicateFiles')}</th>
                <th>{t('duplicateReason')}</th>
              </tr>
            </thead>
            <tbody>
              {duplicateGroups.map((group, idx) => (
                <tr key={idx}>
                  <td>{group.ids.map(id => getFileName(id)).join(', ')}</td>
                  <td>{group.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
