import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { FileItem } from '../types';
import { FileText, Image, File as FileIcon, Trash2, Download, FolderPlus, Upload, Folder, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface ExplorerProps {
  files: FileItem[];
  selectedFile: FileItem | null;
  onSelectFile: (file: FileItem) => void;
  onUpload: (files: File[]) => void;
  onDeleteFile: (id: string) => void;
  onDownloadFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  onCreateFolder: () => void;
}

export const Explorer: React.FC<ExplorerProps> = ({ 
  files, selectedFile, onSelectFile, onUpload, onDeleteFile, onDownloadFile, onRenameFile, onCreateFolder
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [internalDrag, setInternalDrag] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    onUpload(acceptedFiles);
  }, [onUpload]);

  const startEditing = (file: FileItem) => {
    setEditingId(file.id);
    setEditingName(file.name);
  };

  const confirmEditing = (file: FileItem) => {
    if (editingName && editingName !== file.name) {
      onRenameFile(file.id, editingName);
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <Image size={18} color="var(--primary-color)" />;
    if (contentType === 'application/pdf') return <FileText size={18} color="#ef4444" />;
    return <FileIcon size={18} color="var(--text-secondary)" />;
  };

  return (
    <div className="explorer" {...getRootProps()}>
      <input {...getInputProps()} />
      
      <div className="explorer-toolbar">
        <div>
          <button className="btn btn-primary" onClick={() => document.getElementById('file-upload')?.click()}>
            <Upload size={16} />
            Téléverser
            <input
              id="file-upload"
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) onUpload(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
          </button>
          <button className="btn btn-outline" style={{ marginLeft: '12px' }} onClick={() => document.getElementById('folder-upload')?.click()}>
            <Folder size={16} />
            Téléverser un dossier
            <input
              id="folder-upload"
              type="file"
              // @ts-expect-error webkitdirectory is not in the type definitions
              webkitdirectory=""
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) onUpload(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
          </button>
          <button className="btn btn-outline" style={{ marginLeft: '12px' }} onClick={onCreateFolder}>
            <FolderPlus size={16} />
            Nouveau Dossier
          </button>
        </div>
      </div>

      <div className="explorer-content">
        {isDragActive && !internalDrag && (
          <div className="dropzone active">
            <Upload size={32} />
            <p style={{ marginTop: '12px', fontWeight: 500 }}>Déposez les fichiers ici pour les téléverser</p>
          </div>
        )}

        {!isDragActive && !internalDrag && files.length === 0 ? (
          <div className="empty-state">
            <FolderPlus size={48} />
            <h3>Ce dossier est vide</h3>
            <p>Glissez-déposez des fichiers ici ou utilisez le bouton Téléverser.</p>
          </div>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Nom</th>
                <th>Date de valeur</th>
                <th>Description</th>
                <th>Modifié le</th>
                <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr
                  key={file.id}
                  className={`file-row ${selectedFile?.id === file.id ? 'selected' : ''}`}
                  onClick={() => onSelectFile(file)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/kb-file-id', file.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setInternalDrag(true);
                  }}
                  onDragEnd={() => setInternalDrag(false)}
                >
                  <td>
                    <div className="file-name-cell">
                      <Folder size={18} color="var(--text-secondary)" />
                      {file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '/'}
                    </div>
                  </td>
                  <td>
                    <div className="file-name-cell" onClick={(e) => editingId === file.id && e.stopPropagation()}>
                      {getFileIcon(file.contentType)}
                      {editingId === file.id ? (
                        <>
                          <input
                            className="form-control"
                            style={{ padding: '2px 8px', fontSize: '0.9rem', flex: 1 }}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEditing(file);
                              else if (e.key === 'Escape') cancelEditing();
                            }}
                            autoFocus
                          />
                          <button className="icon-btn" title="Valider" onClick={(e) => { e.stopPropagation(); confirmEditing(file); }}>
                            <Check size={14} />
                          </button>
                          <button className="icon-btn" title="Annuler" onClick={(e) => { e.stopPropagation(); cancelEditing(); }}>
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          {file.name}
                          <button
                            className="icon-btn"
                            title="Renommer"
                            onClick={(e) => { e.stopPropagation(); startEditing(file); }}
                          >
                            <Pencil size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td>{file.metadata?.structData?.date_valeur || '-'}</td>
                  <td>
                    <div style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.metadata?.structData?.description || '-'}
                    </div>
                  </td>
                  <td>{format(new Date(file.updated), 'dd/MM/yyyy')}</td>
                  <td>
                    <div className="file-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" onClick={() => onDownloadFile(file.id)} title="Télécharger">
                        <Download size={16} />
                      </button>
                      <button className="icon-btn danger" onClick={() => onDeleteFile(file.id)} title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
