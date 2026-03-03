import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DuplicateDialogProps {
  duplicates: {name: string, id: string}[];
  onOverwrite: () => void;
  onCancel: () => void;
}

export const DuplicateDialog: React.FC<DuplicateDialogProps> = ({
  duplicates,
  onOverwrite,
  onCancel,
}) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <AlertTriangle size={20} color="var(--warning-color)" />
            <span>Fichiers existants</span>
          </div>
          <button className="icon-btn" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p>
            {duplicates.length === 1
              ? 'Le fichier suivant existe déjà dans ce dossier :'
              : 'Les fichiers suivants existent déjà dans ce dossier :'}
          </p>
          <ul className="duplicate-list">
            {duplicates.map((d) => (
              <li key={d.id}>{d.name}</li>
            ))}
          </ul>
          <p>Voulez-vous remplacer {duplicates.length === 1 ? 'ce fichier' : 'ces fichiers'} ?</p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={onOverwrite}>
            Remplacer
          </button>
        </div>
      </div>
    </div>
  );
};
