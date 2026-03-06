import React from 'react';
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
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={20} color="var(--primary-color)" />
            <span>Résultats de l'analyse</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p>
            <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{results.length} Succès</span>
            {' / '}
            <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{failed.length} Échecs</span>
          </p>

          {results.length > 0 && (
            <details>
              <summary>Détails des succès ({results.length})</summary>
              <table className="analyze-results-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Catégorie</th>
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
              <summary>Détails des échecs ({failed.length})</summary>
              <table className="analyze-results-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Erreur</th>
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
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
