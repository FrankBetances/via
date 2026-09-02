/* -------------------------------------------------------------------------- */
/*  Motor de audio COMPARTIDO de VIA+ (un único AudioContext para toda la app). */
/*                                                                             */
/*  POR QUÉ EXISTE ESTE MÓDULO                                                 */
/*  `react-native-audio-api` abre un stream de salida NATIVO por cada           */
/*  `new AudioContext()`:                                                       */
/*    · Android → Oboe con `SharingMode::Exclusive` (AudioPlayer.cpp). El       */
/*      primer contexto se queda el dispositivo en EXCLUSIVA; los siguientes    */
/*      fallan al abrir el stream y quedan MUDOS PARA SIEMPRE, sin lanzar       */
/*      ninguna excepción en JS (`isInitialized_ = false` → `start()` devuelve  */
/*      false y nadie lo mira).                                                 */
/*    · iOS → un AVAudioEngine compartido, pero cada `AudioPlayer.start()`      */
/*      PARA el motor para reconectar sus nodos, cortando lo que estuviera      */
/*      sonando en los demás contextos.                                        */
/*                                                                             */
/*  La app creaba cuatro contextos independientes (tonos de audiometría,        */
/*  palabras de la verbal, consignas habladas de los ejercicios y reproducción  */
/*  de las tomas del análisis acústico). En Android el que arrancaba primero    */
/*  se llevaba el altavoz y el resto de módulos se quedaba en silencio; cuál    */
/*  ganaba dependía del orden de montaje, de ahí que el fallo se percibiera     */
/*  como intermitente («a veces no suena»). Este módulo centraliza UN SOLO      */
/*  contexto con recuento de referencias: todos los módulos comparten el mismo  */
/*  stream nativo y ninguno puede dejar mudo a otro.                            */
/*                                                                             */
/*  SESIÓN DE AUDIO                                                             */
/*  Se centraliza también la sesión (iOS `AVAudioSession`): la reproducción es  */
/*  el modo por defecto (`playback`) y los módulos que necesitan micrófono      */
/*  piden `playAndRecord` con `acquireRecordingSession()`. Al soltar la última  */
/*  petición la sesión vuelve a `playback` sola: antes cada adaptador la        */
/*  reconfiguraba por su cuenta y el sonómetro dejaba la sesión en modo         */
/*  grabación (con la salida atenuada en iOS) si la pantalla se cerraba a       */
/*  mitad de una medición.                                                      */
/* -------------------------------------------------------------------------- */

import type {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioDestinationNode,
  GainNode,
  OscillatorNode,
  StereoPannerNode,
} from 'react-native-audio-api';

/* Metro exige literales en `require(...)`: un `require(variable)` no empaqueta
 * el módulo. El require es opcional para que los tests y los targets sin el
 * módulo nativo sigan compilando (degradación: sin motor no hay sonido, pero
 * la app funciona). */
const optionalAudioApi = (): any => {
  try {
    return require('react-native-audio-api');
  } catch (_e) {
    return null;
  }
};

/** Frecuencia de muestreo única de toda la app (tonos, palabras y consignas). */
export const AUDIO_SAMPLE_RATE = 48000;

/**
 * Superficie del contexto que usa la app. Los tipos de los nodos vienen del
 * paquete (import SOLO de tipos: se borra al compilar, así que este módulo
 * sigue siendo el único que lo carga en runtime), de modo que los adaptadores
 * conservan el tipado fuerte de `createGain()`, `createOscillator()`, etc.
 */
export interface SharedAudioContext {
  readonly currentTime: number;
  readonly state?: string;
  readonly destination: AudioDestinationNode;
  sampleRate: number;
  createOscillator: () => OscillatorNode;
  createGain: () => GainNode;
  createStereoPanner: () => StereoPannerNode;
  createBufferSource: () => AudioBufferSourceNode;
  createBuffer: (channels: number, length: number, sampleRate: number) => AudioBuffer;
  decodeAudioData: (data: ArrayBuffer) => Promise<AudioBuffer>;
  decodeAudioDataSource: (path: string) => Promise<AudioBuffer>;
  resume?: () => Promise<boolean> | void;
  close?: () => Promise<void> | void;
}

let ctx: SharedAudioContext | null = null;
let refCount = 0;
/** El contexto no se pudo crear (target sin módulo nativo): no reintentar en bucle. */
let unavailable = false;

/* ------------------------------ sesión de audio --------------------------- */

const audioManager = (): any => optionalAudioApi()?.AudioManager ?? null;

/** Peticiones vivas de sesión de GRABACIÓN (sonómetro, análisis de voz…). */
let recordingHolders = 0;

const applyPlaybackSession = (): void => {
  const am = audioManager();
  if (!am) return;
  try {
    am.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth', 'allowBluetoothA2DP'],
    });
    void am.setAudioSessionActivity(true);
  } catch {
    /* target sin AudioManager: la sesión la gobierna el sistema */
  }
};

const applyRecordingSession = (): void => {
  const am = audioManager();
  if (!am) return;
  try {
    am.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'measurement',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth'],
    });
    void am.setAudioSessionActivity(true);
  } catch {
    /* target sin AudioManager */
  }
};

/* ---------------------- observadores de la grabación ---------------------- */
/*  Este módulo es el ÚNICO punto por el que pasa todo consumidor de           */
/*  micrófono de la app, así que es también el único sitio donde un tercero    */
/*  puede enterarse de que hay una captura en curso sin tener que conocer los  */
/*  módulos clínicos uno a uno. Lo usa el permiso de ruido del periférico de   */
/*  refuerzo (`src/Lua/noisePermit.ts`, ver docs/design/integracion-lua.md §3):*/
/*  cualquier módulo que abra el micrófono —incluidos los que aún no están     */
/*  escritos— revoca el permiso sin que su autor tenga que saberlo.            */

type RecordingSessionListener = (active: boolean) => void;
const recordingSessionListeners = new Set<RecordingSessionListener>();

/**
 * Avisa de las transiciones 0↔1 del recuento de grabación (no de cada
 * petición: dos módulos grabando a la vez son una sola transición). Devuelve la
 * función para darse de baja.
 */
export function onRecordingSessionChange(listener: RecordingSessionListener): () => void {
  recordingSessionListeners.add(listener);
  return () => {
    recordingSessionListeners.delete(listener);
  };
}

/* Un oyente que lanza NO puede impedir que se reserve la sesión: el micrófono
 * clínico manda sobre cualquier accesorio colgado de este aviso. */
const notifyRecordingSession = (active: boolean): void => {
  recordingSessionListeners.forEach(listener => {
    try {
      listener(active);
    } catch (e) {
      console.warn('VIA+: un oyente de sesión de grabación falló', e);
    }
  });
};

/**
 * Reserva la sesión de audio en modo GRABACIÓN (`playAndRecord`). Devuelve la
 * función de liberación; cuando se suelta la última petición la sesión vuelve
 * a `playback`. Es idempotente por llamador: llamar dos veces a la función de
 * liberación no descuenta dos veces.
 */
export function acquireRecordingSession(): () => void {
  recordingHolders += 1;
  if (recordingHolders === 1) {
    // El aviso va ANTES de reconfigurar la sesión, y no por eficiencia: quien
    // escucha esta transición lo hace para APAGAR algo que puede hacer ruido.
    // El orden seguro es apagar primero y abrir el micrófono después.
    notifyRecordingSession(true);
    applyRecordingSession();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    recordingHolders = Math.max(0, recordingHolders - 1);
    if (recordingHolders === 0) {
      applyPlaybackSession();
      notifyRecordingSession(false);
    }
  };
}

/** ¿Hay alguna captura de micrófono con la sesión reservada? (diagnóstico/tests) */
export const isRecordingSessionActive = (): boolean => recordingHolders > 0;

/* ------------------------------- el contexto ------------------------------ */

/**
 * Reserva el contexto de audio compartido, creándolo en la primera petición.
 * Devuelve `null` si el módulo nativo no está disponible (el llamador debe
 * degradar en silencio, nunca romper la pantalla).
 *
 * Cada `acquireAudioContext()` DEBE emparejarse con un `releaseAudioContext()`
 * (típicamente en la función de limpieza del `useEffect` que lo pidió).
 */
export function acquireAudioContext(): SharedAudioContext | null {
  refCount += 1;
  if (ctx) return ctx;
  if (unavailable) return null;

  const api = optionalAudioApi();
  if (!api?.AudioContext) {
    unavailable = true;
    return null;
  }
  try {
    // La sesión se configura ANTES de abrir el stream: en iOS el motor se
    // activa con la categoría vigente en ese momento.
    applyPlaybackSession();
    ctx = new api.AudioContext({ sampleRate: AUDIO_SAMPLE_RATE }) as SharedAudioContext;
    return ctx;
  } catch (e) {
    console.warn('VIA+: no se pudo abrir el motor de audio', e);
    unavailable = true;
    return null;
  }
}

/**
 * Suelta una reserva del contexto compartido. El contexto NO se cierra en el
 * primer release: solo cuando ya no queda ningún consumidor. Cerrar y reabrir
 * el stream nativo a cada navegación provocaba cortes de audio y, en Android,
 * carreras al reabrir el stream exclusivo.
 */
export function releaseAudioContext(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !ctx) return;
  const closing = ctx;
  ctx = null;
  try {
    void closing.close?.();
  } catch {
    /* noop */
  }
}

/**
 * Contexto compartido SIN tomar una referencia (para código que ya la tiene).
 * `null` si nadie lo ha reservado todavía.
 */
export const peekAudioContext = (): SharedAudioContext | null => ctx;

/* -------------------------------------------------------------------------- */
/*  RECUPERACIÓN DE UN CONTEXTO MUERTO                                         */
/*                                                                             */
/*  El caso: `AudioPlayer::openAudioStream()` falla (otra app tiene el         */
/*  dispositivo en exclusiva, el arranque pilla la salida ocupada), así que    */
/*  `mStream_` queda nulo e `isInitialized_` en `false`. El constructor de     */
/*  `AudioContext` llama a `start()`, IGNORA su `false` y pone                 */
/*  `playerHasBeenStarted_ = true`. A partir de ahí el objeto existe, no lanza */
/*  nunca y NO SUENA NADA en toda la app.                                      */
/*                                                                             */
/*  Y de ese estado NO SE SALE llamando a `resume()`, aunque lo parezca:       */
/*                                                                             */
/*    AudioContext.cpp:59  resume() {                                          */
/*      if (isClosed()) return false;                                          */
/*      if (isRunning()) return true;                                          */
/*      if (!playerHasBeenStarted_) { … audioPlayer_->start() … }  // ← muerta */
/*      return audioPlayer_->resume();   // requestStart() con mStream_ nulo   */
/*    }                                     →  false                           */
/*                                                                             */
/*  La rama que REABRE el stream cuelga de `!playerHasBeenStarted_`, y ese     */
/*  booleano ya vale `true` desde el constructor (VIA+ no crea el contexto     */
/*  suspendido). `AudioPlayer::resume()` solo hace `mStream_->requestStart()`, */
/*  que con `mStream_` nulo devuelve `false`. El único camino de vuelta es un  */
/*  AudioContext NUEVO: otro `AudioPlayer`, otro `openAudioStream()`.          */
/*                                                                             */
/*  Importa porque el contexto se abre AL ARRANCAR LA APP                      */
/*  (`installAudiometryToneAdapter` en `src/App.tsx`) y no se suelta jamás: si */
/*  esa apertura falla, la app entera se queda muda para toda la sesión, sin   */
/*  reintento y sin mensaje. Un usuario lo describe como «el build salió       */
/*  mudo», y no hay nada en el APK que lo distinga de un fallo de código.      */
/* -------------------------------------------------------------------------- */

type AudioContextListener = (ctx: SharedAudioContext | null) => void;
const contextListeners = new Set<AudioContextListener>();

/**
 * Avisa cuando el contexto compartido se SUSTITUYE por uno nuevo. Los
 * adaptadores guardan su propia referencia (`let ctx = acquireAudioContext()`),
 * así que sin este aviso seguirían usando el objeto muerto después de una
 * recuperación. Devuelve la función para darse de baja.
 */
export function onAudioContextChange(listener: AudioContextListener): () => void {
  contextListeners.add(listener);
  return () => {
    contextListeners.delete(listener);
  };
}

const notifyContextChange = (next: SharedAudioContext | null): void => {
  contextListeners.forEach(listener => {
    try {
      listener(next);
    } catch (e) {
      console.warn('VIA+: un oyente del contexto de audio falló', e);
    }
  });
};

/**
 * ¿Está el stream nativo de salida abierto y arrancado?
 *
 * `ctx.state` no expone `state_`, sino `BaseAudioContext::getState()`
 * (BaseAudioContext.cpp:31), que devuelve «suspended» siempre que
 * `isDriverRunning()` sea falso — y eso acaba en `AudioPlayer::isRunning()`
 * (AudioPlayer.cpp:79) = `mStream_ && mStream_->getState() == Started`. Por eso
 * «running» aquí SÍ significa driver vivo. Lo que no significa es que se oiga.
 */
export const isOutputDriverRunning = (): boolean => !!ctx && ctx.state === 'running';

/**
 * Tira el contexto muerto y abre uno nuevo, conservando el recuento de
 * reservas. Devuelve el contexto vivo, o `null` si tampoco se pudo abrir.
 *
 * No hace nada si el driver ya está corriendo: reabrir el stream a lo tonto
 * corta lo que estuviera sonando.
 */
export function recoverAudioContext(): SharedAudioContext | null {
  if (!ctx) return null;
  if (isOutputDriverRunning()) return ctx;

  const dead = ctx;
  ctx = null;
  try {
    void dead.close?.();
  } catch {
    /* un contexto sin stream tampoco cierra bien: da igual, se suelta */
  }

  const api = optionalAudioApi();
  if (!api?.AudioContext) {
    unavailable = true;
    notifyContextChange(null);
    return null;
  }
  try {
    applyPlaybackSession();
    ctx = new api.AudioContext({ sampleRate: AUDIO_SAMPLE_RATE }) as SharedAudioContext;
  } catch (e) {
    console.warn('VIA+: no se pudo reabrir el motor de audio', e);
    ctx = null;
    unavailable = true;
  }
  notifyContextChange(ctx);
  return ctx;
}

/**
 * Reactiva el contexto si el sistema lo suspendió (interrupción de llamada,
 * cambio de ruta de audio, vuelta de segundo plano). Un contexto suspendido
 * reproduce SILENCIO sin dar ningún error, así que conviene llamarlo justo
 * antes de programar un estímulo.
 *
 * LO QUE `ctx.state` SIGNIFICA DE VERDAD (react-native-audio-api 0.8.4, leído
 * en `node_modules`, no de memoria). El constructor pone `state_ = RUNNING`
 * ignorando el booleano de `AudioPlayer::start()` —eso es cierto y es el
 * origen del contexto mudo—, pero lo que llega a JS NO es `state_`:
 *
 *   BaseAudioContext.cpp:31  getState() { if (isDriverRunning()) return toString(state_);
 *                                          … return "suspended"; }
 *   BaseAudioContext.cpp:175 isRunning() { return state_ == RUNNING && isDriverRunning(); }
 *   AudioContext.cpp:105     isDriverRunning() { return audioPlayer_->isRunning(); }
 *   AudioPlayer.cpp:79       isRunning() { return mStream_ && mStream_->getState() == Started; }
 *
 * O sea: `ctx.state` devuelve «suspended» siempre que el stream de Oboe no
 * esté `Started`, aunque `state_` valga RUNNING. La condición de abajo es por
 * tanto exactamente «si el driver no está corriendo, intenta levantarlo».
 *
 * Y llamar a `resume()` de forma INCONDICIONAL no añade nada: `AudioContext::
 * resume()` (AudioContext.cpp:59) abre con `if (isRunning()) return true;`, la
 * misma pregunta hecha en C++. Cuando `state` es «running» es un no-op con un
 * salto por el puente JSI en cada estímulo; cuando no lo es, esta condición ya
 * entra. Por eso se conserva la guarda.
 *
 * La sesión de audio NO se toca aquí. Se aplica al crear el contexto y al
 * soltar la última petición de grabación, y reaplicarla por estímulo no
 * arregla nada: en Android `AudioAPIModule.kt:66` implementa
 * `setAudioSessionOptions` como `// noting to do here` y
 * `setAudioSessionActivity` solo resuelve la promesa. Es una capa iOS.
 */
export function resumeAudioContext(): void {
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') void ctx.resume?.();
  } catch {
    /* state/resume no disponibles en algunos targets */
  }
}

/** ¿Hay motor de audio de salida utilizable? */
export const isAudioEngineAvailable = (): boolean => !unavailable;

/** Solo para tests: reinicia el estado del módulo. */
export function __resetSharedAudioContextForTests(): void {
  ctx = null;
  refCount = 0;
  recordingHolders = 0;
  unavailable = false;
  recordingSessionListeners.clear();
  contextListeners.clear();
}

/** Solo para tests/diagnóstico: nº de reservas vivas del contexto. */
export const audioContextRefCount = (): number => refCount;
