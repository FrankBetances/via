import { getVerbalAudioAdapter } from '@/Screens/VerbalAudiometry/verbalAudiometryAudio';

import { playVoiceAsset, stopVoiceAsset } from './viaVoicePlayback';
import { resolveVoiceAsset, toVoiceLang } from './viaVoiceResolve';
import { VoiceStyle } from './voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Punto de integración runtime de la voz de VIA+ (capa de app).              */
/*                                                                             */
/*  `speak(style, text, lang)` resuelve la MEJOR vía disponible con            */
/*  degradación elegante (P2 del blueprint):                                    */
/*    1. asset neuronal pre-sintetizado de la lengua;                          */
/*    2. asset neuronal base `es` (banco compartido) — audio antes que sistema; */
/*    3. voz del sistema (`react-native-tts`) vía el adaptador de la            */
/*       audiometría verbal (registrado una vez en App.tsx) — NO se duplica     */
/*       el motor TTS ni su selección de voz española;                          */
/*    4. sin voz utilizable: silencio (el clínico lee la consigna).             */
/*                                                                             */
/*  Preempta cualquier locución anterior (un solo slot). Mientras el mapa de    */
/*  assets esté vacío, siempre cae al paso 3/4 → comportamiento idéntico al     */
/*  actual (sin regresión).                                                     */
/* -------------------------------------------------------------------------- */

/** Voz del sistema (TTS) reutilizando el adaptador verbal ya registrado. */
const systemVoice = (text: string): void => {
  try {
    getVerbalAudioAdapter()?.speakText?.(text);
  } catch {
    /* la voz es una ayuda: nunca debe tumbar la pantalla */
  }
};

// Token de preempción: cada `speak` invalida la resolución asíncrona anterior,
// de modo que una locución nueva gana a la que estaba resolviéndose.
let token = 0;

/**
 * Locuta un texto con la prosodia `style` en la lengua de sesión `lang`
 * (`'es' | 'gl' | 'es-DO'`; cualquier otro valor cae a `es`). Fire-and-forget.
 */
export const speak = (style: VoiceStyle, text: string, lang: string = 'es'): void => {
  const l = toVoiceLang(lang);
  const mine = (token += 1);
  const asset = resolveVoiceAsset(style, text, l);
  if (asset == null) {
    stopVoiceAsset();
    systemVoice(text);
    return;
  }
  void playVoiceAsset(asset).then(ok => {
    if (mine !== token) return; // otra locución tomó el relevo
    if (!ok) systemVoice(text); // el asset no decodificó → voz del sistema
  });
};

/** Detiene cualquier locución en curso (asset o voz del sistema). */
export const stopSpeaking = (): void => {
  token += 1;
  stopVoiceAsset();
  try {
    getVerbalAudioAdapter()?.stop?.();
  } catch {
    /* noop */
  }
};

/** ¿Hay alguna vía de voz disponible? (para mostrar/ocultar el botón altavoz). */
export const canSpeak = (): boolean => !!getVerbalAudioAdapter()?.speakText;
