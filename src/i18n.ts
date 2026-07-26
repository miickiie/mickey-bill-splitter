import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enJSON from './locales/en.json';
import thJSON from './locales/th.json';

let savedLanguage: string | null = null;
if (typeof window !== 'undefined') {
  try {
    savedLanguage = localStorage.getItem('bill-splitter-language');
  } catch {
    // Use the default language when storage is unavailable.
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { ...enJSON },
    th: { ...thJSON },
  },
  lng: savedLanguage === 'en' || savedLanguage === 'th' ? savedLanguage : 'th',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
