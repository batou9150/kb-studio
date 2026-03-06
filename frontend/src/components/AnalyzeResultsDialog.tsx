import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';

interface AnalyzeResultsDialogProps {
  results: { id: string; description: string; value_date: string; category: string }[];
  failed: { id: string; error: string }[];
  onClose: () => void;
}

export const AnalyzeResultsDialog: React.FC<AnalyzeResultsDialogProps> = ({
  results,
  failed,
  onClose,
}) => {
  const { t } = useTranslation('dialogs');
  const tc = useTranslation('common').t;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={20} color="var(--primary-color)" />
            <span>{t('analyzeResults.title')}</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p>
            <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{results.length} {tc('labelSuccess')}</span>
            {' / '}
            <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{failed.length} {tc('labelFailures')}</span>
          </p>

          {results.length > 0 && (
            <details>
              <summary>{tc('successDetails', { count: results.length })}</summary>
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
              <summary>{tc('failureDetails', { count: failed.length })}</summary>
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
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            {tc('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
