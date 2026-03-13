import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import frCommon from './locales/fr/common.json';
import frExplorer from './locales/fr/explorer.json';
import frDetails from './locales/fr/details.json';
import frAdmin from './locales/fr/admin.json';
import frSearch from './locales/fr/search.json';
import frAnswer from './locales/fr/answer.json';
import frDialogs from './locales/fr/dialogs.json';
import frInsights from './locales/fr/insights.json';

import enCommon from './locales/en/common.json';
import enExplorer from './locales/en/explorer.json';
import enDetails from './locales/en/details.json';
import enAdmin from './locales/en/admin.json';
import enSearch from './locales/en/search.json';
import enAnswer from './locales/en/answer.json';
import enDialogs from './locales/en/dialogs.json';
import enInsights from './locales/en/insights.json';

const savedLang = localStorage.getItem('kb-studio-lang');
const browserLang = navigator.language.split('-')[0];

i18n.use(initReactI18next).init({
  resources: {
    fr: {
      common: frCommon,
      explorer: frExplorer,
      details: frDetails,
      admin: frAdmin,
      search: frSearch,
      answer: frAnswer,
      dialogs: frDialogs,
      insights: frInsights,
    },
    en: {
      common: enCommon,
      explorer: enExplorer,
      details: enDetails,
      admin: enAdmin,
      search: enSearch,
      answer: enAnswer,
      dialogs: enDialogs,
      insights: enInsights,
    },
  },
  lng: savedLang || (['fr', 'en'].includes(browserLang) ? browserLang : 'fr'),
  fallbackLng: 'fr',
  ns: ['common', 'explorer', 'details', 'admin', 'search', 'answer', 'dialogs', 'insights'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
