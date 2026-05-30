import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import mg from './locales/mg.json';

const STORAGE_KEY = 'naturalodge_lang';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      mg: { translation: mg },
    },
    lng:          localStorage.getItem(STORAGE_KEY) ?? 'fr',
    fallbackLng:  'fr',
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

export default i18n;
