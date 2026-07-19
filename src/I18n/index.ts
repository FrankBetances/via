import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import esVerbalAudiometry from './locales/es/verbalAudiometry.json';
import enVerbalAudiometry from './locales/en/verbalAudiometry.json';
import esDoVerbalAudiometry from './locales/es-DO/verbalAudiometry.json';

/* -------------------------------------------------------------------------- */
/*  i18next — VIA+ (preparado, NO cableado todavía).                           */
/*                                                                             */
/*  La app es hoy monolingüe en español con literales en pantalla (todas las   */
/*  pantallas de módulo) y `t(clave, fallback)` en los bloques PDF. Este       */
/*  módulo deja lista la internacionalización sin imponerla:                   */
/*                                                                             */
/*   - Catálogos por módulo y idioma en `locales/<lng>/<ns>.json`. El primer   */
/*     namespace es `verbalAudiometry` (pantalla + interpretación + PDF +      */
/*     hoja de resultados); el resto de módulos se añaden con el mismo patrón. */
/*   - `initI18n()` se llama una vez en App.tsx cuando se decida activar       */
/*     i18n; después las pantallas migran literal a literal a `useTranslation` */
/*     y los bloques PDF reciben un `t` real en lugar del stub de Report.ts.   */
/*                                                                             */
/*  El test `i18nCatalog.test.ts` garantiza la paridad estructural es/en       */
/*  (mismas claves y mismos placeholders `{{...}}`), de modo que añadir un     */
/*  texto en un idioma sin el otro rompe la CI.                                */
/* -------------------------------------------------------------------------- */

export const I18N_RESOURCES = {
  es: { verbalAudiometry: esVerbalAudiometry },
  en: { verbalAudiometry: enVerbalAudiometry },
  'es-DO': { verbalAudiometry: esDoVerbalAudiometry },
} as const;

export const DEFAULT_LANGUAGE = 'es';

/**
 * Variantes regionales y su idioma base (Q1.1 · Quisqueya Habla): el catálogo
 * de una variante es un DELTA — solo contiene las claves localizadas y el
 * resto resuelve en cascada `es-DO → es` (i18next lo soporta nativamente).
 * El test de catálogo exige que toda clave de la variante exista en su base
 * (subconjunto estricto, sin claves huérfanas).
 */
export const LANGUAGE_VARIANTS: Record<string, keyof typeof I18N_RESOURCES> = {
  'es-DO': 'es',
};

/**
 * Inicializa i18next (idempotente). No se llama en el arranque todavía:
 * activar cuando se decida internacionalizar la app.
 */
export async function initI18n(language: string = DEFAULT_LANGUAGE): Promise<typeof i18n> {
  if (i18n.isInitialized) return i18n;
  await i18n.use(initReactI18next).init({
    resources: I18N_RESOURCES,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'verbalAudiometry',
    interpolation: { escapeValue: false }, // React ya escapa
    returnNull: false,
  });
  return i18n;
}

export default i18n;
