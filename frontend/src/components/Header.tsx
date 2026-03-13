import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Database, FolderOpen, TableOfContents, Search, Settings, BarChart3 } from 'lucide-react';

type ViewType = 'explorer' | 'admin' | 'index' | 'answer' | 'insights';

const pathToView: Record<string, ViewType> = {
  '/': 'explorer',
  '/insights': 'insights',
  '/index': 'index',
  '/search': 'answer',
  '/admin': 'admin',
};

interface HeaderProps {
  onNavigate: (folderId: string) => void;
  appName: string;
  appLogo: string;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, appName, appLogo }) => {
  const { t, i18n } = useTranslation('explorer');
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = pathToView[location.pathname] || 'explorer';

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('kb-studio-lang', lng);
    document.documentElement.lang = lng;
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => { onNavigate(''); navigate('/'); }}>
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
          onClick={() => { onNavigate(''); navigate('/'); }}
        >
          <FolderOpen size={16} />
          {t('nav.knowledgeBase')}
        </button>
        <button
          className={`header-tab ${currentView === 'insights' ? 'active' : ''}`}
          onClick={() => navigate('/insights')}
        >
          <BarChart3 size={16} />
          {t('nav.insights')}
        </button>
        <button
          className={`header-tab ${currentView === 'index' ? 'active' : ''}`}
          onClick={() => navigate('/index')}
        >
          <TableOfContents size={16} />
          {t('nav.indexation')}
        </button>
        <button
          className={`header-tab ${currentView === 'answer' ? 'active' : ''}`}
          onClick={() => navigate('/search')}
        >
          <Search size={16} />
          {t('nav.search')}
        </button>
        <button
          className={`header-tab ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => navigate('/admin')}
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
