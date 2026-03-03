import React from 'react';
import { Search, Database, ChevronRight, Settings } from 'lucide-react';

interface HeaderProps {
  currentFolder: string;
  currentView: 'explorer' | 'admin';
  onSearch: (query: string) => void;
  onNavigate: (folderId: string) => void;
  onViewChange: (view: 'explorer' | 'admin') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentFolder, currentView, onSearch, onNavigate, onViewChange }) => {
  const breadcrumbs = currentFolder.split('/').filter(Boolean);

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => { onNavigate(''); onViewChange('explorer'); }}>
          <Database size={24} />
          KB-Studio
        </div>

        {currentView === 'explorer' && (
          <div className="breadcrumbs">
            <span className="breadcrumb-item" onClick={() => onNavigate('')}>Racine</span>
            {breadcrumbs.map((part, idx) => {
              const path = breadcrumbs.slice(0, idx + 1).join('/') + '/';
              return (
                <React.Fragment key={path}>
                  <ChevronRight size={16} />
                  <span className="breadcrumb-item" onClick={() => onNavigate(path)}>{part}</span>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {currentView === 'explorer' && (
          <div className="search-bar">
            <Search size={18} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Rechercher un fichier..."
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
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
