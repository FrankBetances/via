/* -------------------------------------------------------------------------- */
/*  Selección de la MEJOR voz del sintetizador nativo (TTS) para una lengua.   */
/*                                                                            */
/*  Lógica pura (sin dependencias nativas) para poder probarla: puntúa las     */
/*  voces que devuelve `expo-speech` y elige la que suene más humana y         */
/*  fiable, priorizando (en este orden de peso):                               */
/*    · la lengua pedida, y preferentemente su dialecto principal (es-ES para  */
/*      el castellano, gl-ES para el gallego);                                 */
/*    · disponibles SIN RED — condición de fiabilidad clínica, no un mero      */
/*      desempate: las voces «network» de Google declaran más calidad (500) y  */
/*      suenan mejor, pero cada palabra exige una petición de síntesis online  */
/*      y el dictado se cae A MITAD DE LA PRUEBA en cuanto el wifi de la       */
/*      consulta falla. Una voz instalada debe ganar SIEMPRE a una de red del  */
/*      mismo idioma, por mucha calidad que ésta declare;                      */
/*    · mayor `quality` (Android/iOS: 500 = mejorada/premium > 300 normal);    */
/*    · voces NEURALES (marcadores en id/nombre: «-x-», network, enhanced,     */
/*      neural, premium, wavenet) — mucho más naturales que las clásicas.      */
/*                                                                            */
/*  GALLEGO: la mayoría de dispositivos NO trae voz `gl-*`. En ese caso se     */
/*  degrada a la voz castellana (fonética mucho más próxima que la inglesa    */
/*  por defecto del sistema) y así queda declarado en `pickVoiceForLang`, que  */
/*  informa de si la voz elegida es del idioma pedido o una degradación.       */
/* -------------------------------------------------------------------------- */

export interface TtsVoice {
  id?: string;
  name?: string;
  language?: string;
  quality?: number;
  networkConnectionRequired?: boolean;
  notInstalled?: boolean;
}

/** Prefijos de idioma aceptados por lengua de sesión, en orden de preferencia. */
const LANG_FALLBACKS: Record<string, string[]> = {
  es: ['es'],
  'es-DO': ['es'],
  // Sin voz gallega instalada se dicta con la castellana (degradación
  // declarada); nunca con la voz por defecto del sistema, que suele ser en-US.
  gl: ['gl', 'es'],
  // Euskera: igual que el gallego. La voz `eu-*` existe en Android desde hace
  // años (Google la distribuye) pero no viene instalada de serie; sin ella se
  // degrada a la castellana, cuyo inventario vocálico de cinco vocales es el
  // más próximo al vasco de entre las voces habituales del sistema.
  eu: ['eu', 'es'],
};

/** Dialecto preferido dentro de cada prefijo (bonus de puntuación). */
const PREFERRED_DIALECT: Record<string, string> = { es: 'es-es', gl: 'gl-es', eu: 'eu-es' };

const NEURAL_MARKER = /(-x-|network|enhanced|neural|premium|wavenet|natural)/i;

/** ¿Es una voz española utilizable (instalada y en algún dialecto es-*)? */
export const isUsableSpanishVoice = (v: TtsVoice): boolean =>
  !v.notInstalled && typeof v.language === 'string' && v.language.toLowerCase().startsWith('es');

/** Puntuación de idoneidad (mayor = mejor). Solo tiene sentido para voces es-*. */
export const scoreSpanishVoice = (v: TtsVoice): number => {
  const lang = (v.language ?? '').toLowerCase();
  let score = 0;
  if (lang === 'es-es') score += 3000; // castellano peninsular
  else if (lang.startsWith('es')) score += 1000; // otro español (es-MX, es-US…)
  score += (v.quality ?? 300) * 4; // calidad declarada (300→1200, 500→2000)
  if (NEURAL_MARKER.test(`${v.id ?? ''} ${v.name ?? ''}`)) score += 600; // voz neural
  // Disponible sin red: +1500 para que una voz INSTALADA gane siempre a una de
  // red del mismo dialecto — la ventaja máxima de una voz de red es 1400
  // ((500−300)·4 de calidad + 600 de marcador neural). Con el antiguo +400 la
  // «es-es-x-…-network» (calidad 500) empataba o superaba a la local (400) y el
  // dictado quedaba a merced del wifi de la consulta: sonaba de maravilla hasta
  // que la síntesis online fallaba a mitad de la prueba.
  if (v.networkConnectionRequired === false) score += 1500;
  return score;
};

/**
 * Mejor voz española de la lista, o `null` si no hay ninguna instalada. En
 * empate exacto conserva la primera (orden estable del sistema).
 */
export function pickBestSpanishVoice(voices: TtsVoice[] | null | undefined): TtsVoice | null {
  if (!Array.isArray(voices)) return null;
  let best: TtsVoice | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    if (!isUsableSpanishVoice(v)) continue;
    const s = scoreSpanishVoice(v);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

/** ¿Voz instalada de un prefijo de idioma concreto? */
const isUsableVoiceOf = (v: TtsVoice, prefix: string): boolean =>
  !v.notInstalled && typeof v.language === 'string' && v.language.toLowerCase().startsWith(prefix);

/** Puntuación de idoneidad dentro de un prefijo de idioma. */
const scoreVoiceOf = (v: TtsVoice, prefix: string): number => {
  const lang = (v.language ?? '').toLowerCase();
  let score = lang === PREFERRED_DIALECT[prefix] ? 3000 : 1000;
  score += (v.quality ?? 300) * 4;
  if (NEURAL_MARKER.test(`${v.id ?? ''} ${v.name ?? ''}`)) score += 600;
  if (v.networkConnectionRequired === false) score += 1500;
  return score;
};

export interface VoicePick {
  voice: TtsVoice;
  /** Prefijo de idioma de la voz elegida ('es', 'gl'…). */
  langPrefix: string;
  /** `true` si NO es del idioma pedido (p. ej. gallego dictado con voz es). */
  degraded: boolean;
}

/**
 * Mejor voz para una lengua de sesión, recorriendo sus alternativas declaradas
 * (`LANG_FALLBACKS`). Devuelve `null` si no hay ninguna voz utilizable: en ese
 * caso el adaptador NO dicta —dictar castellano o gallego con la voz inglesa
 * del sistema invalida el estímulo— y degrada a los recortes empaquetados.
 */
export function pickVoiceForLang(
  voices: TtsVoice[] | null | undefined,
  lang: string,
): VoicePick | null {
  if (!Array.isArray(voices)) return null;
  const chain = LANG_FALLBACKS[lang] ?? LANG_FALLBACKS.es;
  for (const prefix of chain) {
    let best: TtsVoice | null = null;
    let bestScore = -Infinity;
    for (const v of voices) {
      if (!isUsableVoiceOf(v, prefix)) continue;
      const s = scoreVoiceOf(v, prefix);
      if (s > bestScore) {
        best = v;
        bestScore = s;
      }
    }
    if (best) return { voice: best, langPrefix: prefix, degraded: prefix !== chain[0] };
  }
  return null;
}

/** Código BCP-47 con el que fijar el idioma del motor si no hay lista de voces. */
export const ttsLanguageTagFor = (lang: string): string =>
  lang === 'gl' ? 'gl-ES' : lang === 'eu' ? 'eu-ES' : lang === 'es-DO' ? 'es-DO' : 'es-ES';
