/* -------------------------------------------------------------------------- */
/*  Reproductor de assets de voz (runtime · expo-audio).                        */
/*                                                                             */
/*  MIGRADO desde `react-native-audio-api`, adoptando la arquitectura de        */
/*  Valeria+ (`src/valeriaVoicePlayback.ts`), que es la que funciona.           */
/*                                                                             */
/*  POR QUÉ SE CAMBIÓ EL MOTOR                                                  */
/*  La versión anterior decodificaba el `.m4a` y lo reproducía sobre el         */
/*  AudioContext compartido de `react-native-audio-api`, es decir sobre un      */
/*  stream de Oboe abierto en modo EXCLUSIVO y compartido con los tonos de las  */
/*  audiometrías. Eso metía las locuciones —que son una ayuda pedagógica, no un */
/*  estímulo calibrado— en la misma cadena crítica y frágil que el estímulo     */
/*  clínico: cualquier problema de apertura del stream dejaba muda la voz de    */
/*  toda la app sin decir por qué, y una locución podía interferir con el       */
/*  estímulo.                                                                   */
/*                                                                             */
/*  `expo-audio` reproduce por las API estándar del sistema (MediaPlayer /      */
/*  AVPlayer), fuera de Oboe. Es exactamente lo que hace Valeria+, que locuta   */
/*  sin problemas en el mismo emulador donde VIA+ se quedaba en silencio.       */
/*                                                                             */
/*  Modo de mezcla `mixWithOthers`: la locución debe CONVIVIR con lo que esté   */
/*  sonando (el babble de ruido competitivo, un tono en curso), nunca pausarlo. */
/*  `playsInSilentMode` porque en consulta la tableta suele estar en silencio.  */
/*                                                                             */
/*  Un ÚNICO slot: empezar una locución detiene la anterior.                    */
/*                                                                             */
/*  Los modelos de IA NUNCA corren aquí: en runtime solo se REPRODUCE audio ya  */
/*  empaquetado (offline-first inviolable, P1).                                 */
/* -------------------------------------------------------------------------- */

/* Carga perezosa del módulo nativo (mismo patrón que Valeria+): si expo-audio
 * no está en este binario, `playVoiceAsset` devuelve `false` y el llamante cae
 * a la voz del sistema en vez de romperse. */
const optionalExpoAudio = (): any => {
  try {
    const mod = require('expo-audio');
    return typeof mod?.createAudioPlayer === 'function' ? mod : null;
  } catch (_e) {
    return null;
  }
};

let current: { player: any; sub: any } | null = null;
/** El modo de sesión se fija una sola vez por proceso, si LOGRA fijarse. */
let modeSet = false;
/** Último fallo al fijar el modo de sesión, para que el diagnóstico lo nombre. */
let modeError: string | null = null;

/**
 * Estado del modo de sesión de las locuciones, para «Comprobar audio».
 *
 * Existe porque el fallo aquí es invisible por naturaleza: si
 * `setAudioModeAsync` rechaza, las locuciones siguen sonando… hasta que la
 * tableta está en silencio (`playsInSilentMode` no se aplicó) o hasta que la
 * locución pausa el estímulo en curso en vez de mezclarse con él. Nada revienta
 * y nadie se entera. Regla 4: un `catch` en ruta clínica necesita al lado un
 * estado que la pantalla pueda enseñar.
 */
export const voiceAudioModeStatus = (): { applied: boolean; error: string | null } => ({
  applied: modeSet,
  error: modeError,
});

/** Modo de mezcla de la sesión (una sola vez por proceso, como Valeria+). */
const ensureAudioMode = (ExpoAudio: any): void => {
  if (modeSet) return;
  // Mezcla: la locución convive con lo que esté sonando, nunca lo pausa.
  const failed = (e: unknown): void => {
    // NO se marca como fijado: el siguiente intento vuelve a probar. Marcarlo
    // antes de la llamada dejaba el modo sin aplicar para toda la sesión.
    modeSet = false;
    modeError = e instanceof Error ? e.message : String(e);
  };
  try {
    const promise = ExpoAudio.setAudioModeAsync?.({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
    modeSet = true;
    modeError = null;
    if (promise && typeof promise.catch === 'function') {
      void promise.catch(failed);
    }
  } catch (e) {
    failed(e);
  }
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const cleanup = (): void => {
  if (!current) return;
  const { player, sub } = current;
  current = null;
  try {
    sub?.remove?.();
  } catch {
    /* noop */
  }
  try {
    player.pause();
  } catch {
    /* ya parado */
  }
  try {
    player.remove();
  } catch {
    /* noop */
  }
};

/** Detiene la locución en curso (si la hay). */
export const stopVoiceAsset = (): void => cleanup();

/**
 * Reproduce el asset de voz pre-sintetizado. Devuelve una promesa a `true` si
 * la reproducción ARRANCÓ, `false` si no hay motor nativo o el asset no se
 * pudo abrir (el llamante degrada a la voz del sistema). Nunca lanza.
 *
 * Se resuelve al ARRANCAR, no al terminar: quien locuta una consigna necesita
 * saber si va a sonar para decidir si degrada, no esperar a que acabe.
 */
export const playVoiceAsset = async (assetModule: number | undefined): Promise<boolean> => {
  if (assetModule == null) return false;
  const ExpoAudio = optionalExpoAudio();
  if (!ExpoAudio) return false;

  try {
    ensureAudioMode(ExpoAudio);

    cleanup();
    const player = ExpoAudio.createAudioPlayer(assetModule);
    // La suscripción existe para SOLTAR el reproductor al terminar: sin ella
    // cada locución dejaría un objeto nativo vivo hasta el recolector.
    const sub = player.addListener?.('playbackStatusUpdate', (status: any) => {
      if (!status?.didJustFinish) return;
      if (current?.player === player) cleanup();
    });
    current = { player, sub };
    player.play();
    return true;
  } catch {
    cleanup();
    return false;
  }
};

/* -------------------------------------------------------------------------- */
/*  SONDA del banco de locuciones (solo para «Comprobar audio»).               */
/*                                                                             */
/*  `playVoiceAsset` devuelve `true` en cuanto `play()` no lanza, y eso es     */
/*  todo lo que necesita quien locuta: si no arranca, degrada a la voz del     */
/*  sistema y sigue. Pero el diagnóstico estaba usando ese mismo `true` para   */
/*  escribir «la primera decodificó y se reprodujo», que es una afirmación     */
/*  MUCHO más fuerte de lo que ese booleano sostiene: `createAudioPlayer`      */
/*  carga de forma asíncrona y `play()` sobre un reproductor que nunca llegó   */
/*  a cargar el fichero tampoco lanza. Un banco de locuciones ilegible se      */
/*  publicaba como CORRECTO.                                                   */
/*                                                                             */
/*  Esta sonda espera a `isLoaded`, lee la duración declarada y comprueba que  */
/*  la posición AVANZA tras `play()`. Sigue sin poder decir que se OIGA —eso   */
/*  solo lo cierra el oído del profesional, y por eso la pantalla lo           */
/*  pregunta—, pero ya no confunde «no ha lanzado» con «ha sonado».            */
/* -------------------------------------------------------------------------- */

export interface VoiceAssetProbe {
  /** ¿El reproductor declaró el fichero cargado? */
  loaded: boolean;
  /** ¿Avanzó la reproducción tras `play()` (posición > 0 o estado «playing»)? */
  advanced: boolean;
  /** Duración declarada por el motor, en segundos (0 = no la sabe). */
  durationSec: number;
  /** Qué ocurrió, en una línea, para el informe de campo. */
  detail: string;
}

/**
 * Carga y reproduce una locución MIDIENDO el resultado. La locución se deja
 * sonando (la pantalla pregunta a continuación si se ha oído).
 *
 * `loadMs` acota la espera de carga y `playMs` la de arranque: un fichero que
 * no carga en un segundo largo no va a cargar, y bloquear el diagnóstico más
 * tiempo solo lo hace inservible en consulta.
 */
export const probeVoiceAsset = async (
  assetModule: number | undefined,
  loadMs = 1500,
  playMs = 600,
): Promise<VoiceAssetProbe> => {
  const nothing = (detail: string): VoiceAssetProbe => ({
    loaded: false,
    advanced: false,
    durationSec: 0,
    detail,
  });
  if (assetModule == null) return nothing('No hay ninguna locución empaquetada que probar.');
  const ExpoAudio = optionalExpoAudio();
  if (!ExpoAudio) {
    return nothing('El módulo `expo-audio` no está en este binario: el banco no puede sonar.');
  }

  let player: any = null;
  try {
    ensureAudioMode(ExpoAudio);
    cleanup();
    player = ExpoAudio.createAudioPlayer(assetModule);
    const sub = player.addListener?.('playbackStatusUpdate', (status: any) => {
      if (!status?.didJustFinish) return;
      if (current?.player === player) cleanup();
    });
    current = { player, sub };

    const loadDeadline = Date.now() + loadMs;
    let loaded = false;
    while (Date.now() < loadDeadline) {
      if (player.isLoaded) {
        loaded = true;
        break;
      }
      await sleep(50);
    }
    if (!loaded) {
      cleanup();
      return nothing(
        `El reproductor no llegó a cargar el fichero en ${(loadMs / 1000).toFixed(1)} s.`,
      );
    }

    const durationSec = Number(player.duration) || 0;
    player.play();

    const playDeadline = Date.now() + playMs;
    let advanced = false;
    while (Date.now() < playDeadline) {
      await sleep(60);
      if (player.playing || (Number(player.currentTime) || 0) > 0) {
        advanced = true;
        break;
      }
    }

    return {
      loaded: true,
      advanced,
      durationSec,
      detail: advanced
        ? `cargó (${durationSec.toFixed(2)} s) y la reproducción avanzó`
        : `cargó (${durationSec.toFixed(2)} s) pero la reproducción NO avanzó tras «play»`,
    };
  } catch (e) {
    cleanup();
    return nothing(
      `El reproductor rechazó la locución: ${e instanceof Error ? e.message : 'error desconocido'}.`,
    );
  }
};

/** Libera el reproductor (limpieza en desmontaje). */
export const disposeVoicePlayback = (): void => {
  stopVoiceAsset();
};

/** Solo para tests: reinicia el estado interno del reproductor de voz. */
export const __resetVoicePlaybackForTests = (): void => {
  cleanup();
  modeSet = false;
  modeError = null;
};

