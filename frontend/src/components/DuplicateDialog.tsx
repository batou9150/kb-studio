import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('dialogs');
  const tc = useTranslation('common').t;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <AlertTriangle size={20} color="var(--warning-color)" />
            <span>{t('duplicate.title')}</span>
          </div>
          <button className="icon-btn" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p>{t('duplicate.message', { count: duplicates.length })}</p>
          <ul className="duplicate-list">
            {duplicates.map((d) => (
              <li key={d.id}>{d.name}</li>
            ))}
          </ul>
          <p>{t('duplicate.confirm', { count: duplicates.length })}</p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>
            {tc('cancel')}
          </button>
          <button className="btn btn-primary" onClick={onOverwrite}>
            {t('duplicate.overwrite')}
          </button>
        </div>
      </div>
    </div>
  );
};
