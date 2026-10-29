import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from './locales/es.json';
import en from './locales/en.json';

// Idioma fijo en español (Kevin, 29/10/2026): el selector de la barra superior se ocultó porque
// solo 5 de 249 componentes están traducidos. Ya no se detecta el idioma del navegador ni se lee
// la preferencia guardada (`memphis:lang`), para que nadie quede con el menú en inglés y el resto
// en español. Las claves en inglés se conservan para cuando se traduzca el ERP completo.
i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: 'es',
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
