import {
  getVerbalAudioAdapter,
  type SpeechProbe,
  type TtsStatus,
} from '@/Screens/VerbalAudiometry/verbalAudiometryAudio';

import { playVoiceAsset, stopVoiceAsset } from './viaVoicePlayback';
import { resolveSpokenText, type SpokenText, type TextByLang } from './viaVoiceLocale';
import { hasVoiceAssets, resolveVoiceAsset, toVoiceLang } from './viaVoiceResolve';
import { VoiceStyle } from './voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Punto de integración runtime de la voz de VIA+ (capa de app).              */
/*                                                                             */
/*  `speak(style, text, lang)` resuelve la MEJOR vía disponible con            */
/*  degradación elegante (P2 del blueprint):                                    */
/*    1. asset neuronal pre-sintetizado de la lengua;                          */
/*    2. asset neuronal base `es` (banco compartido) — audio antes que sistema; */
/*    3. voz del sistema (`expo-speech`) vía el adaptador de la                 */
/*       audiometría verbal (registrado una vez en App.tsx) — NO se duplica     */
/*       el motor TTS ni su selección de voz española;                          */
/*    4. sin voz utilizable: silencio (el clínico lee la consigna).             */
/*                                                                             */
/*  Preempta cualquier locución anterior (un solo slot). Mientras el mapa de    */
/*  assets esté vacío, siempre cae al paso 3/4 → comportamiento idéntico al     */
/*  actual (sin regresión).                                                     */
/* -------------------------------------------------------------------------- */

/** Voz del sistema (TTS) reutilizando el adaptador verbal ya registrado. */
const systemVoice = (text: string, lang: string): void => {
  try {
    getVerbalAudioAdapter()?.speakText?.(text, lang);
  } catch {
    /* la voz es una ayuda: nunca debe tumbar la pantalla */
  }
};

// Token de preempción: cada `speak` invalida la resolución asíncrona anterior,
// de modo que una locución nueva gana a la que estaba resolviéndose.
let token = 0;

/**
 * Locuta un texto con la prosodia `style`.
 *
 * `lang` es la lengua DEL TEXTO, no la de la sesión: quien llama debe haber
 * resuelto antes qué texto va a decir y en qué lengua está (`speakLocalized`
 * lo hace en un paso). Pasar aquí la lengua de sesión con un texto que está en
 * otra es precisamente lo que producía voz gallega leyendo castellano.
 * Fire-and-forget.
 */
export const speak = (style: VoiceStyle, text: string, lang: string = 'es'): void => {
  const l = toVoiceLang(lang);
  const mine = (token += 1);
  const asset = resolveVoiceAsset(style, text, l);
  if (asset == null) {
    stopVoiceAsset();
    systemVoice(text, l);
    return;
  }
  void playVoiceAsset(asset).then(ok => {
    if (mine !== token) return; // otra locución tomó el relevo
    if (!ok) systemVoice(text, l); // el asset no decodificó → voz del sistema
  });
};

/**
 * Vía RECOMENDADA para los módulos: recibe el texto de un banco POR LENGUA y
 * la lengua de sesión, resuelve cuál se dice y con qué voz (`resolveSpokenText`)
 * y lo locuta. Devuelve la locución elegida para que la pantalla pueda mostrar
 * el MISMO texto que va a sonar y advertir si no está en la lengua de sesión.
 *
 * Con esto la correspondencia tarjeta↔voz deja de depender de que cada
 * pantalla se acuerde de resolverla por su cuenta.
 */
export const speakLocalized = (
  style: VoiceStyle,
  byLang: TextByLang,
  sessionLang: string = 'es',
): SpokenText | null => {
  const spoken = resolveSpokenText(byLang, toVoiceLang(sessionLang));
  if (spoken == null) return null;
  speak(style, spoken.text, spoken.lang);
  return spoken;
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

/**
 * ¿Hay alguna vía de voz REAL disponible? (para mostrar/ocultar el botón de
 * altavoz). Antes bastaba con que existiese `speakText`, que está SIEMPRE
 * definido: el botón aparecía también en dispositivos sin voz del sistema y al
 * pulsarlo no sonaba nada. Ahora se exige o bien un motor de voz listo, o bien
 * assets de locución empaquetados.
 *
 * Mientras el motor ARRANCA se responde que sí: la inicialización tarda un par
 * de segundos y ocultar el botón en ese hueco lo hacía aparecer y desaparecer
 * (y `speak` ya espera a que el motor esté listo antes de dictar).
 */
export const canSpeak = (): boolean => {
  const adapter = getVerbalAudioAdapter();
  if (!adapter?.speakText) return false;
  if (hasVoiceAssets()) return true;
  const phase = adapter.ttsStatus?.().phase;
  if (phase) return phase !== 'unavailable';
  // `ttsReady` es opcional (adaptadores de prueba antiguos): si no lo declara,
  // se mantiene el comportamiento histórico de suponer que hay voz.
  if (!adapter.ttsReady) return true;
  return adapter.ttsReady();
};

/**
 * ¿Hay vía REAL para locutar ESTA consigna concreta? A diferencia de
 * `canSpeak()`, que responde «hay alguna voz en el dispositivo», esto responde
 * «esta frase, en esta lengua, va a sonar».
 *
 * LA DIFERENCIA IMPORTA, y es la que dejaba mudo al T.A.R. sin avisar.
 * `canSpeak()` devuelve `true` en cuanto hay CUALQUIER locución empaquetada, y
 * el banco de assets de VIA+ es hoy solo `es-DO`. En una sesión castellana, el
 * modelo hablado del T.A.R. no tiene asset: su única vía es el sintetizador del
 * sistema. Si ese motor no está disponible —lo que ocurría en todos los
 * dispositivos por el filtrado de visibilidad de paquetes de Android, ver el
 * AndroidManifest—, la pantalla seguía anunciando «hay voz», el botón
 * «Escuchar modelo» seguía activo y al pulsarlo no sonaba nada ni se explicaba
 * por qué.
 *
 * Con esto, la pantalla puede decir la verdad ítem a ítem.
 */
export const canSpeakText = (
  style: VoiceStyle,
  byLang: TextByLang,
  sessionLang: string = 'es',
): boolean => {
  const spoken = resolveSpokenText(byLang, toVoiceLang(sessionLang));
  if (spoken == null) return false;
  // 1) Recorte neuronal empaquetado para esta locución y esta lengua.
  if (resolveVoiceAsset(style, spoken.text, spoken.lang) != null) return true;
  // 2) Voz del sistema. `initializing` cuenta como sí: el motor tarda un par de
  //    segundos en arrancar y `speak` espera a que lo haga.
  const adapter = getVerbalAudioAdapter();
  if (!adapter?.speakText) return false;
  const phase = adapter.ttsStatus?.().phase;
  if (phase) return phase !== 'unavailable';
  if (!adapter.ttsReady) return true; // adaptadores de prueba antiguos
  return adapter.ttsReady();
};

/**
 * Estado del motor de voz del sistema, para que una pantalla pueda explicar al
 * profesional por qué no se oye nada (y ofrecerle reintentar) en vez de
 * limitarse a no sonar. `null` si el adaptador no lo declara.
 */
export const voiceStatus = (): TtsStatus | null => getVerbalAudioAdapter()?.ttsStatus?.() ?? null;

/**
 * Dicta una frase de PRUEBA por la misma vía que las consignas y el modelo
 * hablado del T.A.R., y devuelve lo que hizo el motor. `null` si el adaptador
 * no está instalado o no expone la sonda.
 *
 * Es lo único que responde a la pregunta que importa cuando la app está muda:
 * no «¿hay motor?» sino «¿ha salido sonido por esta vía?».
 */
export const probeSystemVoice = (
  text: string,
  lang: string = 'es',
  timeoutMs?: number,
): Promise<SpeechProbe | null> =>
  getVerbalAudioAdapter()?.probeSpeech?.(text, toVoiceLang(lang), timeoutMs) ??
  Promise.resolve(null);

/** Reintenta arrancar el motor de voz del sistema (botón «reintentar»). */
export const retryVoiceEngine = (): Promise<boolean> =>
  getVerbalAudioAdapter()?.retryTts?.() ?? Promise.resolve(false);

/** Suscripción a los cambios de estado del motor (devuelve la baja). */
export const onVoiceStatusChange = (listener: () => void): (() => void) =>
  getVerbalAudioAdapter()?.onTtsStatusChange?.(listener) ?? (() => {});
