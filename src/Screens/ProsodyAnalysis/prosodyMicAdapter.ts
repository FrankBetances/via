import { PermissionsAndroid, Platform } from 'react-native';
import { AudioManager } from 'react-native-audio-api';

import {
  acquireRecorder,
  acquireRecordingSession,
  recorderHealth,
  setRecorderPermissionGranted,
  type SharedRecorder,
} from '@/Audio';
import {
  createDecimator3,
  createVoiceHighpass,
  DECIMATION,
  SAMPLE_RATE,
} from '@/Screens/VoiceAnalysis/voiceDsp';
import { analyseProsody } from './prosodyDsp';
import {
  MAX_TAKE_SEC,
  setProsodyMicAdapter,
  type ProsodyLiveFrame,
  type ProsodyMicAdapter,
} from './useProsodyAnalysis';

/* -------------------------------------------------------------------------- */
/*  prosodyMicAdapter — captura LARGA de habla conectada.                      */
/*                                                                            */
/*  Comparte motor con el análisis de voz (`@/Audio/sharedAudioRecorder`): un  */
/*  solo stream de entrada para toda la app. Lo que cambia respecto a aquel es */
/*  la escala y, con ella, dos cosas:                                          */
/*                                                                            */
/*   · DURACIÓN. Una /a/ sostenida dura 4 s; una narración, hasta dos minutos. */
/*     Por eso hay tope duro y por eso el PCM se acumula decimado a 16 kHz —a  */
/*     48 kHz, dos minutos serían 23 MB en lugar de 7.7—.                      */
/*   · REALIMENTACIÓN. El análisis de voz muestra la F0 en vivo; aquí lo útil  */
/*     es cuánto HABLA lleva acumulada la toma, porque el objetivo de B0.1 son */
/*     30–60 s de habla válida y el reloj de pared no lo dice: si el niño calla*/
/*     veinte segundos, el cronómetro sigue y la muestra no crece.             */
/*                                                                            */
/*  NO reproduce la toma. El análisis de voz sí lo hace, porque el clínico     */
/*  necesita oír la calidad vocal que va a puntuar; aquí lo que se valora son  */
/*  parámetros temporales, y guardar el audio para poder reproducirlo obligaría*/
/*  a retenerlo más tiempo del imprescindible. El PCM vive lo que dura el      */
/*  análisis y se suelta.                                                      */
/* -------------------------------------------------------------------------- */

const DECIMATE = DECIMATION;
const CAPTURE_SR = SAMPLE_RATE * DECIMATE; // 48000

/** Espera tras `stop()` para recoger los últimos bloques del emisor nativo. */
const TAIL_DRAIN_MS = 250;

/** Techo a partir del cual se considera que la señal satura. */
const CLIP_LEVEL = 0.99;

/**
 * Umbral de habla del contador EN VIVO, como fracción del pico visto hasta
 * ahora. Deliberadamente más permisivo que el del análisis (−25 dB ≈ 0.056):
 * en vivo interesa no desanimar al explorador con un contador que no avanza, y
 * la cifra que acaba en el informe es siempre la del análisis posterior, que
 * recalcula sobre la toma completa.
 */
const LIVE_SPEECH_FRACTION = 0.1;

/** Suelo absoluto del contador en vivo (RMS), para que el ruido no cuente. */
const LIVE_SPEECH_FLOOR = 0.01;

/* ------------------------------- permisos --------------------------------- */

/** Ver la nota del adaptador de voz: el permiso se comunica al micrófono
 *  compartido ANTES de abrir el stream, que se abre en el constructor. */
async function ensureMicPermission(): Promise<boolean> {
  const granted = await requestMicPermission();
  setRecorderPermissionGranted(granted);
  return granted;
}

async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Permiso de micrófono',
      message: 'Se necesita el micrófono para registrar la muestra de habla.',
      buttonPositive: 'Permitir',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  try {
    const perm = await AudioManager.requestRecordingPermissions();
    return perm === 'Granted';
  } catch {
    return true; // targets sin AudioManager: el recorder pedirá el permiso
  }
}

/* ------------------------------- adaptador -------------------------------- */

let registered = false;
let disposeCurrent: (() => void) | null = null;

/**
 * Registra el adaptador de captura de prosodia (idempotente; la pantalla lo
 * llama en su `useEffect` de montaje). Devuelve `true` si hay motor de captura.
 */
export function registerProsodyMicAdapter(): boolean {
  if (registered) return true;

  let recorder: SharedRecorder | null = null;
  let unsubscribe: (() => void) | null = null;
  let capturing = false;
  let chunks: Float32Array[] = [];
  let decimate: ((raw: Float32Array) => Float32Array) | null = null;
  let blocksReceived = 0;
  let releaseSession: (() => void) | null = null;
  let liveListener: ((frame: ProsodyLiveFrame) => void) | null = null;

  /* Estado del contador en vivo. */
  let samplesCaptured = 0;
  let speechSamples = 0;
  let peak = 0;
  let clipped = false;

  /** Pasa-alto del feedback en vivo. El PCM guardado va crudo: `analyseProsody`
   *  lo acondiciona por su cuenta, y acondicionarlo dos veces sesgaría el
   *  nivel sobre el que se calculan los umbrales de pausa. */
  const liveHighpass = createVoiceHighpass(SAMPLE_RATE);

  const endRecordingSession = () => {
    releaseSession?.();
    releaseSession = null;
  };

  const ensureRecorder = (): SharedRecorder | null => {
    if (recorder) return recorder;
    const shared = acquireRecorder();
    if (!shared) return null;

    unsubscribe = shared.subscribe(raw => {
      if (!capturing) return; // stream vivo pero fuera de una toma
      try {
        const ds = decimate ? decimate(raw) : new Float32Array(0);
        if (!ds.length) return;
        blocksReceived += 1;
        chunks.push(ds);
        samplesCaptured += ds.length;

        // Nivel y saturación se miden sobre el PCM CRUDO: el pasa-alto quitaría
        // parte de la energía y una toma saturada podría no parecerlo.
        let sum = 0;
        let blockPeak = 0;
        for (let i = 0; i < ds.length; i++) {
          const v = ds[i];
          sum += v * v;
          const a = v < 0 ? -v : v;
          if (a > blockPeak) blockPeak = a;
        }
        const rms = Math.sqrt(sum / ds.length);
        if (blockPeak >= CLIP_LEVEL) clipped = true;
        if (blockPeak > peak) peak = blockPeak;

        // Contador de habla: el bloque cuenta si su nivel acondicionado supera
        // el umbral relativo al pico de la toma.
        const clean = liveHighpass.process(ds);
        let cleanSum = 0;
        for (let i = 0; i < clean.length; i++) cleanSum += clean[i] * clean[i];
        const cleanRms = Math.sqrt(cleanSum / clean.length);
        const threshold = Math.max(LIVE_SPEECH_FLOOR, peak * LIVE_SPEECH_FRACTION);
        if (cleanRms >= threshold) speechSamples += ds.length;

        liveListener?.({
          rms,
          elapsedSec: samplesCaptured / SAMPLE_RATE,
          speechSec: speechSamples / SAMPLE_RATE,
          clipping: clipped,
        });
      } catch {
        /* un bloque corrupto no debe tumbar la captura */
      }
    });

    recorder = shared;
    return shared;
  };

  const adapter: ProsodyMicAdapter = {
    sampleRate: SAMPLE_RATE,

    startRecording: async (onLive?: (frame: ProsodyLiveFrame) => void) => {
      const granted = await ensureMicPermission();
      if (!granted) throw new Error('Permiso de micrófono denegado');

      endRecordingSession();
      releaseSession = acquireRecordingSession();

      chunks = [];
      blocksReceived = 0;
      samplesCaptured = 0;
      speechSamples = 0;
      peak = 0;
      clipped = false;
      decimate = createDecimator3();
      liveHighpass.reset();
      liveListener = onLive ?? null;

      const active = ensureRecorder();
      if (!active) throw new Error('No hay motor de captura de audio disponible');
      capturing = true;
      active.start();
    },

    stopRecording: async (): Promise<Float32Array> => {
      try {
        recorder?.stop();
      } catch {
        /* noop */
      }
      liveListener = null;
      endRecordingSession();

      // Los bloques llegan por el emisor de eventos, o sea en un turno
      // posterior del hilo JS. `capturing` SIGUE EN TRUE durante el vaciado:
      // ponerlo a false antes hacía que el consumidor descartase justo los
      // bloques que esta espera pretendía recoger (misma corrección que en el
      // análisis acústico; ver `voiceMicAdapter`).
      await new Promise<void>(resolve => setTimeout(resolve, TAIL_DRAIN_MS));
      capturing = false;
      decimate = null;

      const cap = Math.floor(MAX_TAKE_SEC * SAMPLE_RATE);
      const total = Math.min(
        cap,
        chunks.reduce((a, c) => a + c.length, 0),
      );
      const pcm = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        if (off >= total) break;
        const take = Math.min(c.length, total - off);
        pcm.set(take === c.length ? c : c.subarray(0, take), off);
        off += take;
      }
      // El PCM se suelta aquí: no se conserva la toma. La pantalla recibe el
      // array, lo analiza y lo deja ir.
      chunks = [];
      return pcm;
    },

    analyse: analyseProsody,

    hasSignal: () => blocksReceived > 0,

    health: recorderHealth,
  };

  disposeCurrent = () => {
    capturing = false;
    liveListener = null;
    chunks = [];
    endRecordingSession();
    unsubscribe?.();
    unsubscribe = null;
    recorder?.release();
    recorder = null;
  };

  setProsodyMicAdapter(adapter);
  registered = true;
  return true;
}

/**
 * Quita el adaptador y libera lo que tuviera abierto (sesión de grabación y
 * reserva del micrófono compartido). Se llama al desmontar la pantalla y en los
 * tests: sin esto la sesión podría quedarse en `playAndRecord` y atenuar el
 * audio del resto de módulos.
 */
export function unregisterProsodyMicAdapter(): void {
  disposeCurrent?.();
  disposeCurrent = null;
  setProsodyMicAdapter(null);
  registered = false;
}

export { CAPTURE_SR };
