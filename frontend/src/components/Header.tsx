import React from 'react';
import { Database, FolderOpen, Globe, Settings } from 'lucide-react';

interface HeaderProps {
  currentView: 'explorer' | 'admin' | 'search';
  onNavigate: (folderId: string) => void;
  onViewChange: (view: 'explorer' | 'admin' | 'search') => void;
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
          className={`header-tab ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => onViewChange('search')}
        >
          <Globe size={16} />
          Vertex AI Search
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
