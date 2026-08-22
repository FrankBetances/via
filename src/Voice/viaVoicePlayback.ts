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
/** El modo de sesión se fija una sola vez por proceso. */
let modeSet = false;

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
    if (!modeSet) {
      modeSet = true;
      // Mezcla: la locución convive con lo que esté sonando, nunca lo pausa.
      void ExpoAudio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      });
    }

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

/** Libera el reproductor (limpieza en desmontaje). */
export const disposeVoicePlayback = (): void => {
  stopVoiceAsset();
};
