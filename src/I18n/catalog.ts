/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo activo · MÓDULO PURO                                        */
/*                                                                             */
/*  PORTE de `src/i18n/catalog.ts` de Valeria+ (regla 1), incluida la razón de  */
/*  que exista separado: aquí vive `tNow()` y nada más. Está aparte de          */
/*  `I18n/index.ts` —que expone el hook `useT()`— porque un script de Node      */
/*  tiene que poder compilar y ejecutar los módulos de datos sin arrastrar      */
/*  React ni react-redux.                                                       */
/*                                                                             */
/*  En Valeria+ lo descubrió un gate que compila un módulo con `tsc` y lo       */
/*  ejecuta en Node: al localizar las notificaciones, ese módulo pasó a         */
/*  importar el catálogo, y si el catálogo trae React por dentro               */
/*  (`useSyncExternalStore`) el gate revienta con «Cannot find module 'react'»  */
/*  aunque el código de producción funcione. Aquí la figura es la misma con     */
/*  `scripts/export-voice-corpus.js` y `scripts/build-voice-asset-map.js`.      */
/*                                                                             */
/*  Regla, entonces: los módulos que NO son componentes importan de AQUÍ; las   */
/*  pantallas importan `useT` de `./index`.                                     */
/* -------------------------------------------------------------------------- */
import { getUiLang, UiLang } from './uiLang';
import { ES, UiStrings } from './strings.es';
import { GL } from './strings.gl';
import { EU } from './strings.eu';
import { CA } from './strings.ca';
import { ES_419 } from './strings.es-419';
import { ES_DO } from './strings.es-DO';
import { EN } from './strings.en';

/**
 * Un catálogo por variedad. `Record<UiLang, UiStrings>` no admite huecos: dar
 * de alta una lengua en `SESSION_LANGS` sin escribir su catálogo rompe `tsc`.
 */
export const CATALOGUES: Record<UiLang, UiStrings> = {
  es: ES,
  gl: GL,
  eu: EU,
  ca: CA,
  'es-419': ES_419,
  'es-DO': ES_DO,
  en: EN,
};

/**
 * Catálogo activo ahora mismo. Sin suscripción: quien lo llama lee el idioma
 * del momento (los bloques del PDF al generarse, los informes al exportarse).
 */
export const tNow = (): UiStrings => CATALOGUES[getUiLang()];

export type { UiStrings };
