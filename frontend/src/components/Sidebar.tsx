import React, { useState } from 'react';
import { Folder, FolderOpen, FolderPlus, Home } from 'lucide-react';
import type { FolderNode } from '../types';

interface SidebarProps {
  folders: string[];
  currentFolder: string;
  onSelectFolder: (folderId: string) => void;
  onMoveFile: (fileId: string, folderId: string) => void;
  onUploadToFolder: (files: File[], folderId: string) => void;
  onCreateFolder: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ folders, currentFolder, onSelectFolder, onMoveFile, onUploadToFolder, onCreateFolder }) => {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  // Build a simple tree for rendering
  const tree: FolderNode[] = [];
  
  folders.forEach(f => {
    const parts = f.split('/').filter(Boolean);
    let currentLevel = tree;
    let pathAcc = '';
    
    parts.forEach((part, _i) => {
      pathAcc += part + '/';
      let existingNode = currentLevel.find(n => n.name === part);
      
      if (!existingNode) {
        existingNode = { id: pathAcc, name: part, path: pathAcc, children: [] };
        currentLevel.push(existingNode);
      }
      
      currentLevel = existingNode.children!;
    });
  });

  const renderTree = (nodes: FolderNode[], level = 0) => {
    return nodes.map(node => {
      const isSelected = currentFolder === node.id || currentFolder.startsWith(node.id);
      const isExactMatch = currentFolder === node.id;
      
      return (
        <div key={node.id}>
          <div
            className={`folder-item ${isExactMatch ? 'active' : ''} ${dragOverFolderId === node.id ? 'drag-over' : ''}`}
            style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            onClick={() => onSelectFolder(node.id)}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(node.id); }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverFolderId(null);
              const fileId = e.dataTransfer.getData('application/kb-file-id');
              if (fileId) {
                onMoveFile(fileId, node.id);
              } else if (e.dataTransfer.files.length > 0) {
                onUploadToFolder(Array.from(e.dataTransfer.files), node.id);
              }
            }}
          >
            {isSelected ? <FolderOpen size={18} /> : <Folder size={18} />}
            {node.name}
          </div>
          {node.children && node.children.length > 0 && (
            <div>{renderTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        Dossiers
        <button className="icon-btn" title="Nouveau Dossier" onClick={onCreateFolder}>
          <FolderPlus size={18} />
        </button>
      </div>
      <div className="folder-tree">
        <div
          className={`folder-item ${currentFolder === '' ? 'active' : ''} ${dragOverFolderId === '' ? 'drag-over' : ''}`}
          onClick={() => onSelectFolder('')}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(''); }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverFolderId(null);
            const fileId = e.dataTransfer.getData('application/kb-file-id');
            if (fileId) {
              onMoveFile(fileId, '');
            } else if (e.dataTransfer.files.length > 0) {
              onUploadToFolder(Array.from(e.dataTransfer.files), '');
            }
          }}
        >
          <Home size={18} /> Racine
        </div>
        {renderTree(tree)}
      </div>
    </aside>
  );
};
