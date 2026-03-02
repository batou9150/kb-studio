import React from 'react';
import { Search, Database, ChevronRight } from 'lucide-react';

interface HeaderProps {
  currentFolder: string;
  onSearch: (query: string) => void;
  onNavigate: (folderId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentFolder, onSearch, onNavigate }) => {
  const breadcrumbs = currentFolder.split('/').filter(Boolean);

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <Database size={24} />
          KB-Studio
        </div>
        
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
      </div>
      
      <div className="search-bar">
        <Search size={18} color="var(--text-secondary)" />
        <input 
          type="text" 
          placeholder="Rechercher un fichier..." 
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    </header>
  );
};
