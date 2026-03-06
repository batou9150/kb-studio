import React from 'react';
import { useTranslation } from 'react-i18next';

interface AnalyzeResultsTableProps {
  results: { id: string; description: string; value_date: string; category: string }[];
  failed: { id: string; error: string }[];
}

export const AnalyzeResultsTable: React.FC<AnalyzeResultsTableProps> = ({ results, failed }) => {
  const tc = useTranslation('common').t;

  return (
    <>
      <p>
        <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{results.length} {tc('labelSuccess')}</span>
        {' / '}
        <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{failed.length} {tc('labelFailures')}</span>
      </p>

      {results.length > 0 && (
        <details>
          <summary style={{ fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>{tc('successDetails', { count: results.length })}</summary>
          <table className="analyze-results-table">
            <thead>
              <tr>
                <th>{tc('colDescription')}</th>
                <th>{tc('colDate')}</th>
                <th>{tc('colCategory')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
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

      {failed.length > 0 && (
        <details>
          <summary style={{ fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>{tc('failureDetails', { count: failed.length })}</summary>
          <table className="analyze-results-table">
            <thead>
              <tr>
                <th>{tc('colId')}</th>
                <th>{tc('colError')}</th>
              </tr>
            </thead>
            <tbody>
              {failed.map((f) => (
                <tr key={f.id}>
                  <td title={f.id}>{f.id.length > 12 ? f.id.slice(0, 12) + '…' : f.id}</td>
                  <td>{f.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
};
