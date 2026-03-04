import React from 'react';
import { Database, FolderOpen, TableOfContents, Settings } from 'lucide-react';

interface HeaderProps {
  currentView: 'explorer' | 'admin' | 'index';
  onNavigate: (folderId: string) => void;
  onViewChange: (view: 'explorer' | 'admin' | 'index') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onViewChange }) => {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => { onNavigate(''); onViewChange('explorer'); }}>
          <Database size={24} />
          KB-Studio
        </div>
      </div>

      <nav className="header-tabs">
        <button
          className={`header-tab ${currentView === 'explorer' ? 'active' : ''}`}
          onClick={() => { onNavigate(''); onViewChange('explorer'); }}
        >
          <FolderOpen size={16} />
          Knowledge Base
        </button>
        <button
          className={`header-tab ${currentView === 'index' ? 'active' : ''}`}
          onClick={() => onViewChange('index')}
        >
          <TableOfContents size={16} />
          Indexation
        </button>
        <button
          className={`header-tab ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => onViewChange('admin')}
        >
          <Settings size={16} />
          Administration
        </button>
      </nav>
    </header>
  );
};
