import React, { useState } from 'react';
import { api } from '../api';
import { FolderPlus, Pencil, Trash2, AlertTriangle, Loader } from 'lucide-react';

interface AdminPanelProps {
  folders: string[];
  onDataChanged: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ folders, onDataChanged }) => {
  const [loading, setLoading] = useState(false);

  const handleCreateFolder = async () => {
    const name = prompt('Nom du nouveau dossier :');
    if (!name) return;
    try {
      setLoading(true);
      await api.createFolder(name + '/');
      onDataChanged();
    } catch {
      alert('Erreur lors de la création du dossier.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFolder = async (folder: string) => {
    const newName = prompt('Nouveau nom du dossier :', folder.replace(/\/$/, ''));
    if (!newName || newName === folder.replace(/\/$/, '')) return;
    try {
      setLoading(true);
      await api.renameFolder(folder, newName.endsWith('/') ? newName : newName + '/');
      onDataChanged();
    } catch {
      alert('Erreur lors du renommage du dossier.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (folder: string) => {
    if (!window.confirm(`Supprimer le dossier "${folder}" et tout son contenu ?`)) return;
    try {
      setLoading(true);
      await api.deleteFolder(folder);
      onDataChanged();
    } catch {
      alert('Erreur lors de la suppression du dossier.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Supprimer TOUS les fichiers de la base de connaissances ?')) return;
    if (!window.confirm('Cette action est irréversible. Confirmer la suppression ?')) return;
    try {
      setLoading(true);
      await api.deleteAllFiles();
      onDataChanged();
    } catch {
      alert('Erreur lors de la suppression.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Gestion des dossiers</h2>
          <button className="btn btn-primary" onClick={handleCreateFolder} disabled={loading}>
            <FolderPlus size={16} /> Nouveau dossier
          </button>
        </div>

        <table className="file-table">
          <thead>
            <tr>
              <th>Dossier</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {folders.length === 0 ? (
              <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Aucun dossier</td></tr>
            ) : (
              folders.map(folder => {
                const depth = folder.split('/').filter(Boolean).length - 1;
                return (
                  <tr key={folder}>
                    <td style={{ paddingLeft: `${16 + depth * 20}px` }}>{folder}</td>
                    <td>
                      <div className="file-actions">
                        <button className="icon-btn" title="Renommer" onClick={() => handleRenameFolder(folder)} disabled={loading}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn danger" title="Supprimer" onClick={() => handleDeleteFolder(folder)} disabled={loading}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="danger-zone">
        <div className="danger-zone-header">
          <AlertTriangle size={20} />
          <h3>Zone dangereuse</h3>
        </div>
        <p>Supprimer définitivement tous les fichiers et métadonnées de la base de connaissances.</p>
        <button className="btn btn-danger" onClick={handleDeleteAll} disabled={loading}>
          {loading ? <Loader size={16} className="spinner" /> : <Trash2 size={16} />}
          {loading ? 'Suppression en cours...' : 'Supprimer tous les fichiers'}
        </button>
      </div>
    </div>
  );
};
