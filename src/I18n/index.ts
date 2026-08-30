import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import esVerbalAudiometry from './locales/es/verbalAudiometry.json';
import enVerbalAudiometry from './locales/en/verbalAudiometry.json';
import glVerbalAudiometry from './locales/gl/verbalAudiometry.json';
import euVerbalAudiometry from './locales/eu/verbalAudiometry.json';
import caVerbalAudiometry from './locales/ca/verbalAudiometry.json';
import es419VerbalAudiometry from './locales/es-419/verbalAudiometry.json';
import esDoVerbalAudiometry from './locales/es-DO/verbalAudiometry.json';

/* -------------------------------------------------------------------------- */
/*  i18next — VIA+ (internacionalización multi-idioma).                        */
/* -------------------------------------------------------------------------- */

export const I18N_RESOURCES = {
  es: { verbalAudiometry: esVerbalAudiometry },
  en: { verbalAudiometry: enVerbalAudiometry },
  gl: { verbalAudiometry: glVerbalAudiometry },
  eu: { verbalAudiometry: euVerbalAudiometry },
  ca: { verbalAudiometry: caVerbalAudiometry },
  'es-419': { verbalAudiometry: es419VerbalAudiometry },
  'es-DO': { verbalAudiometry: esDoVerbalAudiometry },
} as const;

export const DEFAULT_LANGUAGE = 'es';

/**
 * Variantes regionales y su idioma base (Q1.1 · Quisqueya Habla / LatAm): el catálogo
 * de una variante es un DELTA — solo contiene las claves localizadas y el
 * resto resuelve en cascada `es-DO / es-419 → es` (i18next lo soporta nativamente).
 * El test de catálogo exige que toda clave de la variante exista en su base
 * (subconjunto estricto, sin claves huérfanas).
 */
export const LANGUAGE_VARIANTS: Record<string, keyof typeof I18N_RESOURCES> = {
  'es-DO': 'es',
  'es-419': 'es',
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
