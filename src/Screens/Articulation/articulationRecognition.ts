/* -------------------------------------------------------------------------- */
/*  Puerta de reconocimiento de voz del T.A.R. (A2 · Zero-PHI).                */
/*                                                                            */
/*  MÓDULO PURO: sin React Native, sin librerías nativas. Toda la decisión de  */
/*  «¿puedo transcribir?» vive aquí para poder probarla exhaustivamente, que   */
/*  es lo que exige una decisión de la que depende si la voz de un menor sale  */
/*  o no del dispositivo.                                                     */
/*                                                                            */
/*  EL PROBLEMA QUE RESUELVE                                                   */
/*                                                                            */
/*  Los reconocedores del sistema son de SERVIDOR por defecto. En iOS,         */
/*  `SFSpeechAudioBufferRecognitionRequest` sale con                           */
/*  `requiresOnDeviceRecognition = NO` salvo que se diga lo contrario; en      */
/*  Android, `SpeechRecognizer` enruta al proveedor, que normalmente es la     */
/*  nube. Es decir: la ruta por defecto envía la voz del niño a Apple o a      */
/*  Google, y lo hace sin avisar y sin fallar.                                */
/*                                                                            */
/*  LA REGLA                                                                   */
/*                                                                            */
/*  Solo hay DOS modos posibles, y el tipo lo impone: `'on-device'` y          */
/*  `'unavailable'`. **No existe un modo `'server'`.** No es que esté          */
/*  desaconsejado: no se puede representar. Si el dispositivo no puede         */
/*  garantizar reconocimiento local, el T.A.R. degrada a clasificación SODA    */
/*  manual —que el módulo soporta entero— en vez de transcribir por red.      */
/*                                                                            */
/*  FALLO CERRADO                                                              */
/*                                                                            */
/*  «No se ha podido comprobar» cuenta como «no». Es la decisión central de    */
/*  este fichero: una capacidad que no se puede confirmar NO se asume. Así,    */
/*  mientras la capa nativa no exponga la consulta (ver `nativeContract`       */
/*  abajo), el reconocimiento queda apagado y la voz del menor no viaja a      */
/*  ningún sitio. Cuando la capa nativa llegue, la puerta se abre sola.        */
/* -------------------------------------------------------------------------- */

/** Modos posibles. Nótese la ausencia deliberada de `'server'`. */
export type RecognitionMode = 'on-device' | 'unavailable';

/** Por qué no se puede transcribir (o `'ok'` si sí se puede). */
export type RecognitionBlockReason =
  | 'ok'
  /** La librería de reconocimiento no está instalada o no enlaza. */
  | 'no-library'
  /** La capa nativa no expone cómo confirmar el modo local: no se asume. */
  | 'cannot-confirm'
  /** El dispositivo no tiene modelo local para esa lengua. */
  | 'no-local-model';

/**
 * Lo que la capa nativa ha podido responder sobre sus capacidades.
 *
 * Los `boolean | null` son deliberados: `null` significa **no se ha podido
 * preguntar**, que es distinto de `false` («se preguntó y dijo que no»). Los
 * dos bloquean, pero por motivos distintos, y el clínico merece saber cuál.
 */
export interface RecognitionCaps {
  /** ¿Está la librería de reconocimiento presente y enlazada? */
  libraryAvailable: boolean;
  /**
   * ¿Confirma la plataforma que existe modelo LOCAL para el locale pedido?
   * iOS: `SFSpeechRecognizer.supportsOnDeviceRecognition`.
   * Android: `SpeechRecognizer.isOnDeviceRecognitionAvailable()` (API 33+).
   */
  onDeviceSupported: boolean | null;
  /**
   * ¿Confirma la plataforma que al arrancar FORZARÁ el modo local, y no solo
   * lo preferirá?
   *
   * La distinción importa y no es sutil: el extra `EXTRA_PREFER_OFFLINE` de
   * Android es una PREFERENCIA, no una garantía —el proveedor puede ignorarla
   * y salir a la red—. Solo cuenta como `true` un mecanismo que garantice el
   * modo local: `requiresOnDeviceRecognition = YES` en iOS, o
   * `createOnDeviceSpeechRecognizer()` en Android 33+. Con una preferencia no
   * se puede firmar una promesa de Zero-PHI.
   */
  onDeviceEnforced: boolean | null;
}

export interface RecognitionDecision {
  mode: RecognitionMode;
  reason: RecognitionBlockReason;
}

/**
 * Decide si el T.A.R. puede transcribir. Función total y pura.
 *
 * INVARIANTE, cubierto por prueba: **no existe ninguna entrada que devuelva un
 * modo distinto de `'on-device'` o `'unavailable'`**, y `'on-device'` exige que
 * las dos capacidades estén confirmadas afirmativamente.
 */
export function resolveRecognitionMode(caps: RecognitionCaps): RecognitionDecision {
  if (!caps.libraryAvailable) return { mode: 'unavailable', reason: 'no-library' };

  // Se preguntó y la plataforma dijo que NO hay modelo local para esa lengua.
  if (caps.onDeviceSupported === false) {
    return { mode: 'unavailable', reason: 'no-local-model' };
  }

  // No se ha podido preguntar, o la plataforma no garantiza el modo local.
  // Fallo cerrado: lo que no se confirma, no se asume.
  if (caps.onDeviceSupported === null || caps.onDeviceEnforced !== true) {
    return { mode: 'unavailable', reason: 'cannot-confirm' };
  }

  return { mode: 'on-device', reason: 'ok' };
}

/** ¿Puede transcribirse con esta configuración? */
export const canRecognize = (caps: RecognitionCaps): boolean =>
  resolveRecognitionMode(caps).mode === 'on-device';

/**
 * Explicación para la pantalla. El clínico tiene que poder distinguir «este
 * dispositivo no puede» de «esta lengua no tiene modelo descargado», porque la
 * segunda la resuelve él desde los ajustes del sistema y la primera no.
 */
export function recognitionBlockLabel(reason: RecognitionBlockReason): string {
  switch (reason) {
    case 'ok':
      return 'Reconocimiento en el dispositivo.';
    case 'no-library':
      return 'Este dispositivo no incorpora reconocimiento de voz. Clasificación SODA manual.';
    case 'no-local-model':
      return (
        'No hay modelo de reconocimiento descargado para esta lengua. ' +
        'Descárguelo en los ajustes del sistema, o clasifique manualmente: ' +
        'VIA+ no transcribe a través de internet.'
      );
    case 'cannot-confirm':
    default:
      return (
        'No se puede garantizar que el reconocimiento ocurra en el dispositivo, ' +
        'así que queda desactivado. La voz del paciente no sale del equipo. ' +
        'Clasificación SODA manual.'
      );
  }
}

/* -------------------------------------------------------------------------- */
/*  CONTRATO CON LA CAPA NATIVA (pendiente de implementar)                     */
/*                                                                            */
/*  `@react-native-voice/voice@3.2.4` NO permite hoy garantizar el modo local, */
/*  y se ha verificado leyendo su código, no suponiéndolo:                    */
/*                                                                            */
/*   · iOS (`ios/Voice/Voice.m`) crea el                                       */
/*     `SFSpeechAudioBufferRecognitionRequest` y solo fija                     */
/*     `shouldReportPartialResults`. `requiresOnDeviceRecognition` no aparece  */
/*     en NINGÚN fichero del paquete, y `startSpeech` solo recibe el locale.   */
/*   · Android (`VoiceModule.java`) traslada las opciones al `RecognizerIntent`*/
/*     con un `switch` que es una LISTA BLANCA sin rama `default`: una clave   */
/*     no contemplada —`EXTRA_PREFER_OFFLINE` -- se descarta EN SILENCIO.      */
/*                                                                            */
/*  Para que esta puerta pueda abrirse, la capa nativa debe ofrecer:           */
/*                                                                            */
/*   1. `isOnDeviceRecognitionAvailable(locale) → boolean`                     */
/*      iOS: `SFSpeechRecognizer(locale).supportsOnDeviceRecognition`          */
/*      Android: `SpeechRecognizer.isOnDeviceRecognitionAvailable(context)`    */
/*   2. Arranque que GARANTICE el modo local                                   */
/*      iOS: `request.requiresOnDeviceRecognition = YES`                       */
/*      Android: `SpeechRecognizer.createOnDeviceSpeechRecognizer()` (API 33+) */
/*                                                                            */
/*  Mientras eso no exista, `probeRecognitionCaps` devuelve `null` en las dos  */
/*  capacidades y la puerta permanece cerrada. Es el comportamiento correcto:  */
/*  el módulo pierde una ayuda de cribado y conserva la garantía de que la voz */
/*  del niño no sale del dispositivo.                                          */
/* -------------------------------------------------------------------------- */

/** Superficie mínima que se le pide a la capa nativa (aún no implementada). */
export interface NativeRecognitionProbe {
  isOnDeviceRecognitionAvailable?: (locale: string) => Promise<boolean>;
  /** Presencia = el arranque forzará modo local (no solo preferirlo). */
  startRequiresOnDevice?: boolean;
}

/**
 * Interroga a la capa nativa. Cualquier ausencia, error o respuesta ambigua se
 * traduce a `null` — «no se ha podido confirmar» — y por tanto a puerta cerrada.
 */
export async function probeRecognitionCaps(
  voice: NativeRecognitionProbe | null | undefined,
  locale: string,
): Promise<RecognitionCaps> {
  if (!voice) {
    return { libraryAvailable: false, onDeviceSupported: null, onDeviceEnforced: null };
  }

  let onDeviceSupported: boolean | null = null;
  if (typeof voice.isOnDeviceRecognitionAvailable === 'function') {
    try {
      const supported = await voice.isOnDeviceRecognitionAvailable(locale);
      onDeviceSupported = typeof supported === 'boolean' ? supported : null;
    } catch {
      onDeviceSupported = null;
    }
  }

  const onDeviceEnforced = voice.startRequiresOnDevice === true ? true : null;

  return { libraryAvailable: true, onDeviceSupported, onDeviceEnforced };
}
