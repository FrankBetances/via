/* -------------------------------------------------------------------------- */
/*  VIA+ · Acceso al catálogo de interfaz                                       */
/*                                                                             */
/*  PORTE de `src/i18n/index.ts` de Valeria+ (regla 1). Dos formas de leer las  */
/*  cadenas, según quién pregunte:                                              */
/*                                                                             */
/*    useT()  — pantallas React. Se suscribe al idioma activo, así que          */
/*              cambiarlo en Créditos repinta la app entera sin reiniciar ni    */
/*              volver atrás.                                                   */
/*    tNow()  — módulos que NO son componentes (bloques del PDF, exportación    */
/*              de informes). Vive en `./catalog`, que es un módulo puro sin    */
/*              React: los gates de CI compilan esos módulos y los ejecutan en  */
/*              Node. Importar `tNow` desde aquí también funciona en la app,    */
/*              pero un script debe importarlo de `./catalog` para no arrastrar */
/*              React.                                                          */
/*                                                                             */
/*  Uso en pantalla:                                                            */
/*    const t = useT();                                                         */
/*    <Text>{t.credits.navTitle}</Text>                                         */
/*    <Text>{t.langPicker.change(lang)}</Text>                                  */
/*                                                                             */
/*  El acceso es por PROPIEDAD, no por clave de texto (`t('credits.navTitle')`):*/
/*  así una clave inexistente o mal escrita la caza el compilador, no el QA.    */
/*                                                                             */
/*  QUÉ SUSTITUYE A QUÉ (agosto 2026). Antes de esto, `I18n/` era una capa      */
/*  i18next «preparada, NO cableada»: siete catálogos JSON, `i18next` y         */
/*  `react-i18next` en el `package.json` y un `initI18n()` que NO llamaba       */
/*  nadie. Ni un solo componente usaba `useTranslation`, así que la app se      */
/*  pintaba entera con literales castellanos y el selector no podía cambiar     */
/*  nada. Se retira por la regla 1 —Valeria+ no usa i18next, y su patrón está   */
/*  demostrado en el emulador de Frank— y porque una dependencia que nadie      */
/*  importa no es inofensiva: se autolinka y se compila en cada build.          */
/* -------------------------------------------------------------------------- */
import { useSyncExternalStore } from 'react';

import { getUiLang, subscribeUiLang } from './uiLang';
import { CATALOGUES, tNow, UiStrings } from './catalog';

/**
 * Catálogo activo, reactivo. `getUiLang` como snapshot es estable (devuelve un
 * literal, no un objeto nuevo), así que `useSyncExternalStore` no entra en
 * bucle de renders.
 */
export function useT(): UiStrings {
  const lang = useSyncExternalStore(subscribeUiLang, getUiLang, getUiLang);
  return CATALOGUES[lang];
}

export { tNow, CATALOGUES };
export type { UiStrings };
