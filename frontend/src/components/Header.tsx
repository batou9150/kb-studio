import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database, FolderOpen, TableOfContents, Search, Settings } from 'lucide-react';

interface HeaderProps {
  currentView: 'explorer' | 'admin' | 'index' | 'answer';
  onNavigate: (folderId: string) => void;
  onViewChange: (view: 'explorer' | 'admin' | 'index' | 'answer') => void;
  appName: string;
  appLogo: string;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onViewChange, appName, appLogo }) => {
  const { t, i18n } = useTranslation('explorer');

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('kb-studio-lang', lng);
    document.documentElement.lang = lng;
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => { onNavigate(''); onViewChange('explorer'); }}>
          {appLogo ? (
            <img src={appLogo} alt="" style={{ height: 24 }} />
          ) : (
            <Database size={24} />
          )}
          {appName}
        </div>
      </div>

      <nav className="header-tabs">
        <button
          className={`header-tab ${currentView === 'explorer' ? 'active' : ''}`}
          onClick={() => { onNavigate(''); onViewChange('explorer'); }}
        >
          <FolderOpen size={16} />
          {t('nav.knowledgeBase')}
        </button>
        <button
          className={`header-tab ${currentView === 'index' ? 'active' : ''}`}
          onClick={() => onViewChange('index')}
        >
          <TableOfContents size={16} />
          {t('nav.indexation')}
        </button>
        <button
          className={`header-tab ${currentView === 'answer' ? 'active' : ''}`}
          onClick={() => onViewChange('answer')}
        >
          <Search size={16} />
          {t('nav.search')}
        </button>
        <button
          className={`header-tab ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => onViewChange('admin')}
        >
          <Settings size={16} />
          {t('nav.admin')}
        </button>
      </nav>

      <div className="header-right">
        <select
          className="lang-switcher"
          value={i18n.language}
          onChange={(e) => changeLanguage(e.target.value)}
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>
      </div>
    </header>
  );
};
