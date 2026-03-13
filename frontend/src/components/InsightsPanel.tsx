import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileItem } from '../types';
import { BucketSelector } from './BucketSelector';

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
  const { t } = useTranslation('insights');
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
    </div>
  );
};
