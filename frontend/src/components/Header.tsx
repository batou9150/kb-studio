import React from 'react';
import { Database, FolderOpen, TableOfContents, Search, Settings } from 'lucide-react';

interface HeaderProps {
  currentView: 'explorer' | 'admin' | 'index' | 'answer';
  onNavigate: (folderId: string) => void;
  onViewChange: (view: 'explorer' | 'admin' | 'index' | 'answer') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onViewChange }) => {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => { onNavigate(''); onViewChange('explorer'); }}>
          {import.meta.env.VITE_APP_LOGO ? (
            <img src={import.meta.env.VITE_APP_LOGO} alt="" style={{ height: 24 }} />
          ) : (
            <Database size={24} />
          )}
          {import.meta.env.VITE_APP_NAME || 'KB-Studio'}
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
          className={`header-tab ${currentView === 'answer' ? 'active' : ''}`}
          onClick={() => onViewChange('answer')}
        >
          <Search size={16} />
          Search
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
