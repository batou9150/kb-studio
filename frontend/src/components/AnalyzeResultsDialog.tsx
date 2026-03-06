import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { AnalyzeResultsTable } from './AnalyzeResultsTable';

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
    <Modal
      onClose={onClose}
      icon={<Sparkles size={20} color="var(--primary-color)" />}
      title={t('analyzeResults.title')}
      width={600}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          {tc('close')}
        </button>
      }
    >
      <AnalyzeResultsTable results={results} failed={failed} />
    </Modal>
  );
};
