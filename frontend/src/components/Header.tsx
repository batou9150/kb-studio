import React from 'react';
import { Database, Settings, Globe } from 'lucide-react';

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className={`icon-btn ${currentView === 'search' ? 'active' : ''}`}
          title="Vertex AI Search"
          onClick={() => onViewChange(currentView === 'search' ? 'explorer' : 'search')}
        >
          <Globe size={20} />
        </button>
        <button
          className={`icon-btn ${currentView === 'admin' ? 'active' : ''}`}
          title="Administration"
          onClick={() => onViewChange(currentView === 'admin' ? 'explorer' : 'admin')}
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
};
