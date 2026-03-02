import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Download, Trash2, Move } from 'lucide-react';
import type { FileItem } from '../types';

interface DetailsPanelProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateMetadata: (id: string, description: string, date: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({ 
  file, isOpen, onClose, onUpdateMetadata, onDownload, onDelete, onMove 
}) => {
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (file) {
      setDescription(file.metadata?.structData?.description || '');
      setDate(file.metadata?.structData?.date_valeur || '');
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleSave = () => {
    onUpdateMetadata(file.id, description, date);
  };

  return (
    <div className={`details-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <FileText size={20} color="var(--primary-color)" />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
            {file.name}
          </span>
        </div>
        <button className="icon-btn" onClick={onClose}><X size={20} /></button>
      </div>
      
      <div className="panel-content">
        <div className="preview-box">
          {file.contentType.startsWith('image/') ? (
            <div style={{ textAlign: 'center' }}>
               <FileText size={48} color="var(--text-secondary)" />
               <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Aperçu d'image non disponible sans URL signée</p>
            </div>
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

        <hr style={{ margin: '24px 0', borderColor: 'var(--border-color)', borderTop: 'none' }} />

        <div className="form-group">
          <label>Actions rapides</label>
          <div className="panel-actions">
            <button className="btn btn-outline" onClick={() => onDownload(file.id)}>
              <Download size={16} /> Télécharger
            </button>
            <button className="btn btn-outline" onClick={() => onMove(file.id)}>
              <Move size={16} /> Déplacer
            </button>
          </div>
          <button className="btn btn-danger" style={{ width: '100%', marginTop: '12px' }} onClick={() => onDelete(file.id)}>
            <Trash2 size={16} /> Supprimer le fichier
          </button>
        </div>
      </div>
    </div>
  );
};
