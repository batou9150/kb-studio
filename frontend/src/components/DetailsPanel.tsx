import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Pencil, Check, Loader } from 'lucide-react';
import type { FileItem } from '../types';
import { api } from '../api';

interface DetailsPanelProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateMetadata: (id: string, description: string, date: string) => void;
  onRenameFile: (id: string, newName: string) => void;
}

const getPreviewType = (contentType: string): 'image' | 'pdf' | 'text' | 'other' => {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'application/xml') return 'text';
  return 'other';
};

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  file, isOpen, onClose, onUpdateMetadata, onRenameFile
}) => {
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [fileName, setFileName] = useState('');
  const [textContent, setTextContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      setDescription(file.metadata?.structData?.description || '');
      setDate(file.metadata?.structData?.date_valeur || '');
      setFileName(file.name);
      setEditingName(false);

      // Reset preview state
      setTextContent(null);
      setPreviewError(null);
      setPreviewLoading(false);

      const previewType = getPreviewType(file.contentType);
      if (previewType !== 'text') return;

      setPreviewLoading(true);
      let cancelled = false;

      api.getTextContent(file.id)
        .then(content => { if (!cancelled) setTextContent(content); })
        .catch(err => { if (!cancelled) setPreviewError(err.message || 'Failed to load preview'); })
        .finally(() => { if (!cancelled) setPreviewLoading(false); });

      return () => { cancelled = true; };
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleSave = () => {
    onUpdateMetadata(file.id, description, date);
  };

  return (
    <div className={`details-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          <FileText size={20} color="var(--primary-color)" style={{ flexShrink: 0 }} />
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <input
                className="form-control"
                style={{ padding: '4px 8px', fontSize: '0.9rem' }}
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && fileName && fileName !== file.name) {
                    onRenameFile(file.id, fileName);
                    setEditingName(false);
                  } else if (e.key === 'Escape') {
                    setFileName(file.name);
                    setEditingName(false);
                  }
                }}
                autoFocus
              />
              <button
                className="icon-btn"
                title="Valider"
                onClick={() => {
                  if (fileName && fileName !== file.name) onRenameFile(file.id, fileName);
                  setEditingName(false);
                }}
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                {file.name}
              </span>
              <button className="icon-btn" title="Renommer" onClick={() => setEditingName(true)} style={{ flexShrink: 0 }}>
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>
        <button className="icon-btn" onClick={onClose} style={{ flexShrink: 0 }}><X size={20} /></button>
      </div>
      
      <div className="panel-content">
        <div className={`preview-box${getPreviewType(file.contentType) === 'pdf' ? ' preview-box-pdf' : ''}`}>
          {getPreviewType(file.contentType) === 'image' ? (
            <img src={api.getPreviewUrl(file.id)} alt={file.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : getPreviewType(file.contentType) === 'pdf' ? (
            <iframe src={api.getPreviewUrl(file.id)} title={file.name} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : previewLoading ? (
            <Loader size={32} className="spinner" />
          ) : previewError ? (
            <div style={{ textAlign: 'center' }}>
              <FileText size={48} color="var(--text-secondary)" />
              <p style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--danger-color)' }}>{previewError}</p>
            </div>
          ) : textContent !== null ? (
            <pre className="preview-text">{textContent}</pre>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <FileText size={48} color="var(--text-secondary)" />
              <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>{file.contentType}</p>
            </div>
          )}
        </div>

        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Métadonnées (Gemini)</h3>

        <div className="form-group">
          <label htmlFor="date_valeur">Date de valeur</label>
          <input 
            type="date" 
            id="date_valeur" 
            className="form-control" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea 
            id="description" 
            className="form-control" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave}>
          <Save size={16} /> Enregistrer les modifications
        </button>
      </div>
    </div>
  );
};
