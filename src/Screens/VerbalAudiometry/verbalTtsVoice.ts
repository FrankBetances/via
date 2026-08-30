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
/*      mismo idioma, por mucha calidad que ésta declare. Cómo se sabe cuál    */
/*      es cuál está explicado en el bloque «DISPONIBILIDAD SIN RED»: NO por   */
/*      la bandera `networkConnectionRequired`, que `expo-speech` no envía     */
/*      nunca, sino leyendo el id como hace Valeria+;                          */
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
  'es-419': ['es'],
  // Sin voz gallega instalada se dicta con la castellana (degradación
  // declarada); nunca con la voz por defecto del sistema, que suele ser en-US.
  gl: ['gl', 'es'],
  // Euskera: igual que el gallego.
  eu: ['eu', 'es'],
  // Catalán: si no hay voz catalana instalada, degrada a castellano.
  ca: ['ca', 'es'],
  // Inglés: busca voz en inglés.
  en: ['en'],
};

/** Dialecto preferido dentro de cada prefijo (bonus de puntuación). */
const PREFERRED_DIALECT: Record<string, string> = {
  es: 'es-es',
  gl: 'gl-es',
  eu: 'eu-es',
  ca: 'ca-es',
  'es-419': 'es-mx',
  'es-DO': 'es-do',
  en: 'en-us',
};

const NEURAL_MARKER = /(-x-|network|enhanced|neural|premium|wavenet|natural)/i;

/* -------------------------------------------------------------------------- */
/*  DISPONIBILIDAD SIN RED — cómo se sabe, y por qué NO por la bandera.        */
/*                                                                             */
/*  Este módulo puntuaba «+1500 si la voz no necesita red» leyendo             */
/*  `networkConnectionRequired === false`. Esa bandera NO EXISTE en el motor   */
/*  que la app usa: `expo-speech` devuelve las voces con `VoiceRecord`, que    */
/*  declara EXACTAMENTE cuatro campos —`identifier`, `name`, `quality`,        */
/*  `language`— (node_modules/expo-speech/android/src/main/java/expo/modules/  */
/*  speech/VoiceRecord.kt, y el tipo `Voice` de Speech.types.ts dice lo        */
/*  mismo). `notInstalled` tampoco existe. Las dos llegaban siempre            */
/*  `undefined`, así que `=== false` era siempre falso y la regla que este     */
/*  módulo declaraba como imprescindible NUNCA se aplicó.                      */
/*                                                                             */
/*  Consecuencia medible con la puntuación de abajo: la voz de red de Google   */
/*  (`es-es-x-eed-network`, calidad Enhanced → 500·4 = 2000) ganaba a la       */
/*  local equivalente (`es-es-x-eed-local`, Default → 300·4 = 1200) por 800    */
/*  puntos. Es decir: la app elegía sistemáticamente la voz que EXIGE          */
/*  conectividad. Sin red, Android emite `onError` por locución y no se oye    */
/*  nada — y en el modelo hablado del T.A.R., que es fuego y olvido, no hay    */
/*  degradación: la pantalla se queda muda sin decir por qué.                  */
/*                                                                             */
/*  Valeria+ —la referencia demostrada, regla 1— no usa la bandera: lee el     */
/*  id. `scoreVoice` de `src/valeriaVoice.ts` hace `if (id.includes('local'))  */
/*  s += 2;` y `if (id.includes('network')) s += 1;`, y penaliza los motores   */
/*  heredados con `-6`. Aquí se porta esa misma disciplina a esta escala.      */
/* -------------------------------------------------------------------------- */

/** Voces de Google TTS servidas desde el dispositivo (`…-x-eed-local`). */
const LOCAL_MARKER = /local/i;
/** Voces que sintetizan EN SERVIDOR: suenan mejor y no suenan sin cobertura. */
const NETWORK_MARKER = /network/i;
/** Motores heredados notoriamente metálicos (misma lista que Valeria+). */
const LEGACY_MARKER = /(eloquence|compact|espeak|pico)/i;

/** id + nombre en minúsculas, que es donde el motor deja estas marcas. */
const voiceTag = (v: TtsVoice): string => `${v.id ?? ''} ${v.name ?? ''}`.toLowerCase();

/**
 * ¿Se puede sintetizar con esta voz SIN conexión? Es una condición de
 * fiabilidad clínica, no un desempate: una voz de red se cae a mitad de la
 * prueba en cuanto el wifi de la consulta falla, y en el emulador de
 * Android Studio no llega a sonar nunca.
 *
 * Se prefiere la bandera del motor cuando existe (iOS/web podrían declararla);
 * si no, se lee el id, que es lo único que `expo-speech` entrega.
 */
export const isOfflineVoice = (v: TtsVoice): boolean => {
  if (v.networkConnectionRequired === false) return true;
  if (v.networkConnectionRequired === true) return false;
  const tag = voiceTag(v);
  if (NETWORK_MARKER.test(tag)) return false;
  return LOCAL_MARKER.test(tag);
};

/** Bonus por no depender de la red. Mayor que la ventaja máxima de una voz de
 *  red (800 de calidad + 600 de marcador neural), para que una voz INSTALADA
 *  gane SIEMPRE a una de red del mismo idioma. */
const OFFLINE_BONUS = 1500;
/** Penalización de los motores heredados: por debajo de cualquier alternativa. */
const LEGACY_PENALTY = 3000;

/** ¿Es una voz española utilizable (instalada y en algún dialecto es-*)? */
export const isUsableSpanishVoice = (v: TtsVoice): boolean =>
  !v.notInstalled && typeof v.language === 'string' && v.language.toLowerCase().startsWith('es');

/** Puntuación de idoneidad (mayor = mejor). Solo tiene sentido para voces es-*. */
export const scoreSpanishVoice = (v: TtsVoice): number => {
  const lang = (v.language ?? '').toLowerCase();
  const tag = voiceTag(v);
  let score = 0;
  if (lang === 'es-es') score += 3000; // castellano peninsular
  else if (lang.startsWith('es')) score += 1000; // otro español (es-MX, es-US…)
  score += (v.quality ?? 300) * 4; // calidad declarada (300→1200, 500→2000)
  if (NEURAL_MARKER.test(tag)) score += 600; // voz neural
  if (isOfflineVoice(v)) score += OFFLINE_BONUS;
  if (LEGACY_MARKER.test(tag)) score -= LEGACY_PENALTY;
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
  const tag = voiceTag(v);
  let score = lang === PREFERRED_DIALECT[prefix] ? 3000 : 1000;
  score += (v.quality ?? 300) * 4;
  if (NEURAL_MARKER.test(tag)) score += 600;
  if (isOfflineVoice(v)) score += OFFLINE_BONUS;
  if (LEGACY_MARKER.test(tag)) score -= LEGACY_PENALTY;
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
export const ttsLanguageTagFor = (lang: string): string => {
  switch (lang) {
    case 'gl':
      return 'gl-ES';
    case 'eu':
      return 'eu-ES';
    case 'ca':
      return 'ca-ES';
    case 'es-DO':
      return 'es-DO';
    case 'es-419':
      return 'es-419';
    case 'en':
      return 'en-US';
    default:
      return 'es-ES';
  }
};
