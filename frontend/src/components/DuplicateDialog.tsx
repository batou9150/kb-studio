import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

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
    <Modal
      onClose={onCancel}
      icon={<AlertTriangle size={20} color="var(--warning-color)" />}
      title={t('duplicate.title')}
      footer={
        <>
          <button className="btn btn-outline" onClick={onCancel}>
            {tc('cancel')}
          </button>
          <button className="btn btn-primary" onClick={onOverwrite}>
            {t('duplicate.overwrite')}
          </button>
        </>
      }
    >
      <p>{t('duplicate.message', { count: duplicates.length })}</p>
      <ul className="duplicate-list">
        {duplicates.map((d) => (
          <li key={d.id}>{d.name}</li>
        ))}
      </ul>
      <p>{t('duplicate.confirm', { count: duplicates.length })}</p>
    </Modal>
  );
};
