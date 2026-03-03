import React from 'react';
import { Folder, FolderOpen, Home } from 'lucide-react';
import type { FolderNode } from '../types';

interface SidebarProps {
  folders: string[];
  currentFolder: string;
  onSelectFolder: (folderId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ folders, currentFolder, onSelectFolder }) => {
  // Build a simple tree for rendering
  const tree: FolderNode[] = [];
  
  folders.forEach(f => {
    const parts = f.split('/').filter(Boolean);
    let currentLevel = tree;
    let pathAcc = '';
    
    parts.forEach((part, i) => {
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
            className={`folder-item ${isExactMatch ? 'active' : ''}`}
            style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            onClick={() => onSelectFolder(node.id)}
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
      </div>
      <div className="folder-tree">
        <div 
          className={`folder-item ${currentFolder === '' ? 'active' : ''}`}
          onClick={() => onSelectFolder('')}
        >
          <Home size={18} /> Racine
        </div>
        {renderTree(tree)}
      </div>
    </aside>
  );
};
