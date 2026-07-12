/* -------------------------------------------------------------------------- */
/*  Selección de la MEJOR voz española del sintetizador nativo (TTS).          */
/*                                                                            */
/*  Lógica pura (sin dependencias nativas) para poder probarla: puntúa las     */
/*  voces que devuelve `react-native-tts` y elige la que suene más humana y    */
/*  fiable, priorizando (en este orden de peso):                               */
/*    · español, y preferentemente es-ES (castellano peninsular);              */
/*    · disponibles SIN RED — condición de fiabilidad clínica, no un mero      */
/*      desempate: las voces «network» de Google declaran más calidad (500) y  */
/*      suenan mejor, pero cada palabra exige una petición de síntesis online  */
/*      y el dictado se cae A MITAD DE LA PRUEBA en cuanto el wifi de la       */
/*      consulta falla. Una voz instalada debe ganar SIEMPRE a una de red del  */
/*      mismo idioma, por mucha calidad que ésta declare;                      */
/*    · mayor `quality` (Android/iOS: 500 = mejorada/premium > 300 normal);    */
/*    · voces NEURALES (marcadores en id/nombre: «-x-», network, enhanced,     */
/*      neural, premium, wavenet) — mucho más naturales que las clásicas.      */
/* -------------------------------------------------------------------------- */

export interface TtsVoice {
  id?: string;
  name?: string;
  language?: string;
  quality?: number;
  networkConnectionRequired?: boolean;
  notInstalled?: boolean;
}

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
