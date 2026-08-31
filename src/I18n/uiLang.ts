/* -------------------------------------------------------------------------- */
/*  VIA+ · Idioma de la INTERFAZ — segundo eje de idioma.                       */
/*                                                                             */
/*  PORTE LITERAL de `src/valeriaUiLang.ts` de Valeria+ (regla 1: existe un     */
/*  camino demostrado en el emulador de Frank, se copia, no se inventa otro).   */
/*  Lo que cambia respecto al original está anotado abajo con su motivo.        */
/*                                                                             */
/*  Hasta aquí VIA+ tenía UN solo eje de idioma: `Store/slices/localeSlice`,    */
/*  la VARIEDAD DE SESIÓN, que decide qué banco de estímulos se presenta, con   */
/*  qué voz se locuta y en qué lengua reconoce el T.A.R. La interfaz era        */
/*  siempre castellana, así que no hacía falta más.                            */
/*                                                                             */
/*  Son DOS ejes, igual que en Valeria+:                                       */
/*                                                                             */
/*    Variedad (localeSlice) → qué se le dice, se le muestra y se le evalúa     */
/*                             AL NIÑO.                                        */
/*    UiLang (este módulo)   → en qué idioma lee la app el PROFESIONAL.         */
/*                                                                             */
/*  Y, como en Valeria+, el BOTÓN MUEVE LOS DOS. Frank lo dejó dicho allí con   */
/*  estas palabras: «si estamos trabajando en una versión en inglés, es en      */
/*  inglés para toda la app». Lo que había antes no era media app en inglés,    */
/*  era peor: interfaz cambiada y voz leyendo castellano por debajo.            */
/*                                                                             */
/*  DIVERGENCIA RESPECTO A VALERIA+, con su motivo:                            */
/*                                                                             */
/*   · Valeria+ mantiene `OWNED_LOCALES` y guarda la variedad anterior para     */
/*     devolverla, porque allí los idiomas de interfaz (3) son un SUBCONJUNTO   */
/*     de las variedades de terapia (6): salir del inglés no dice a cuál        */
/*     volver. Aquí la correspondencia es 1:1 —las siete variedades de          */
/*     `SESSION_LANGS` son las siete de interfaz—, así que no hay nada que      */
/*     recordar y ese baile sobra. Menos estado, mismo comportamiento.          */
/*                                                                             */
/*   · La variedad vive en redux (ya persistida por redux-persist), no en un    */
/*     módulo suelto. Por eso `setAppLanguage` recibe el `dispatch`: este       */
/*     módulo no importa el store, para no arrastrar react-redux a los gates    */
/*     de Node que compilan y ejecutan los módulos de datos.                    */
/*                                                                             */
/*  Diferencia técnica con `localeSlice`: la variedad se lee en el momento de   */
/*  hablar, así que un valor en el store basta. El idioma de la UI tiene que    */
/*  REPINTAR la pantalla al cambiar, así que aquí sí hay suscripción            */
/*  (`useSyncExternalStore` la consume desde `./index`).                        */
/* -------------------------------------------------------------------------- */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SESSION_LANGS, SessionLang } from '@/Store/slices/sessionLangs';

/**
 * Idiomas de interfaz. Son EXACTAMENTE las variedades de sesión: castellano,
 * galego, euskara, català, español latinoamericano, dominicano e inglés.
 *
 * Se deriva de `SESSION_LANGS` a propósito, no se reescribe: una lengua nueva
 * se añade en un solo sitio y el compilador obliga a darle catálogo (ver
 * `catalog.ts`, cuyo `Record<UiLang, UiStrings>` no admite huecos).
 */
export type UiLang = SessionLang;
export const ALL_UI_LANGS: readonly UiLang[] = SESSION_LANGS;
export const DEFAULT_UI_LANG: UiLang = 'es';

export const isUiLang = (v: unknown): v is UiLang =>
  typeof v === 'string' && (ALL_UI_LANGS as readonly string[]).includes(v);

/** Idioma válido a partir de lo que devuelva el disco (o el defecto seguro). */
export const resolveInitialUiLang = (value: unknown): UiLang =>
  isUiLang(value) ? value : DEFAULT_UI_LANG;

const KEY = '@via_ui_lang';

/*  Defecto seguro: castellano. Es lo que ve hoy todo el mundo, así que
 *  mientras el disco responde nadie percibe un cambio. */
let active: UiLang = DEFAULT_UI_LANG;

/* ------------------------------------------------------------- suscripción */
const listeners = new Set<() => void>();

export function subscribeUiLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const emit = (): void => {
  listeners.forEach(fn => {
    fn();
  });
};

/* ----------------------------------------------------------------- lectura */
export const getUiLang = (): UiLang => active;

/* ---------------------------------------------------------------- escritura */
/**
 * Fija el idioma de la INTERFAZ y lo persiste. No toca la variedad de sesión:
 * para mover las dos cosas a la vez está `setAppLanguage`.
 */
export async function setUiLang(lang: UiLang): Promise<void> {
  const changed = active !== lang;
  active = lang;
  try {
    await AsyncStorage.setItem(KEY, lang);
  } catch {
    /* almacenamiento no disponible: vale para esta sesión */
  }
  if (changed) emit();
}

/**
 * El botón de idioma cambia la APP ENTERA: textos Y locuciones.
 *
 * `dispatch` lo pone quien llama (el selector), para que este módulo siga
 * siendo puro y los gates de Node puedan importarlo sin react-redux. La acción
 * que hay que pasar es `setSessionLanguage` de `localeSlice`.
 */
export async function setAppLanguage(
  lang: UiLang,
  applyVariety: (lang: UiLang) => void,
): Promise<void> {
  // La variedad primero: si el disco falla al persistir la interfaz, al menos
  // lo que se le presenta al niño y lo que se locuta ya están en su sitio.
  applyVariety(lang);
  await setUiLang(lang);
}

/* --------------------------------------------------------------- hidratación */
/**
 * Perezosa al importar, igual que en Valeria+: si el disco tarda, las primeras
 * pantallas salen en castellano (defecto seguro) y se repintan al resolver.
 */
export const hydrateUiLang = async (): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    const resolved = resolveInitialUiLang(stored);
    if (resolved !== active) {
      active = resolved;
      emit();
    }
  } catch {
    active = DEFAULT_UI_LANG;
  }
};

void hydrateUiLang();
