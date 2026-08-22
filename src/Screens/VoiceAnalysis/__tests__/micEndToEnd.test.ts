/* -------------------------------------------------------------------------- */
/*  «El micrófono no graba y genera un audio vacío», de extremo a extremo.      */
/*                                                                             */
/*  Recorre la ruta REAL —voiceMicAdapter → sharedAudioRecorder → AudioRecorder */
/*  nativo— contra un motor simulado que respeta el contrato del nativo, y      */
/*  comprueba qué PCM sale por `stopRecording()`. Los tests que ya existían     */
/*  vigilan el CICLO DE VIDA del stream (que no se reconstruya, que no se       */
/*  dupliquen suscripciones); ninguno seguía una muestra de audio desde el      */
/*  motor hasta el buffer devuelto, que es justo donde se pierde.               */
/* -------------------------------------------------------------------------- */

const mockRecorders: any[] = [];
const mockCallbacks: Array<(ev: unknown) => void> = [];

jest.mock('react-native-audio-api', () => {
  /**
   * Réplica del contrato de `AndroidAudioRecorder`:
   *  · los bloques solo salen cuando el buffer circular junta `bufferLength`;
   *  · `stop()` VACÍA el resto por el mismo callback (`sendRemainingData`).
   * Reproducir ese vaciado es imprescindible: es la parte del contrato que el
   * adaptador se estaba comiendo.
   */
  class FakeRecorder {
    public pending: number[] = [];
    public started = false;
    public sr: number;
    public block: number;
    constructor(o: { sampleRate: number; bufferLengthInSamples: number }) {
      this.sr = o.sampleRate;
      this.block = o.bufferLengthInSamples;
      mockRecorders.push(this);
    }
    onAudioReady(cb: (ev: unknown) => void) {
      mockCallbacks.push(cb);
    }
    private emit(n: number) {
      const data = Float32Array.from({ length: n }, (_, i) =>
        0.5 * Math.sin((2 * Math.PI * 220 * i) / this.sr),
      );
      for (const cb of mockCallbacks) cb({ buffer: { getChannelData: () => data }, numFrames: n });
    }
    /** El hardware entrega `frames` muestras al buffer circular. */
    feed(frames: number) {
      this.pending.push(frames);
      let total = this.pending.reduce((a, b) => a + b, 0);
      while (total >= this.block) {
        this.emit(this.block);
        total -= this.block;
      }
      this.pending = total > 0 ? [total] : [];
    }
    start() {
      this.started = true;
    }
    stop() {
      this.started = false;
      // sendRemainingData(): el resto del buffer circular sale ahora.
      const rest = this.pending.reduce((a, b) => a + b, 0);
      this.pending = [];
      if (rest > 0) this.emit(rest);
    }
  }
  return {
    AudioRecorder: FakeRecorder,
    AudioManager: {
      setAudioSessionOptions() {},
      setAudioSessionActivity: async () => true,
      requestRecordingPermissions: async () => 'Granted',
    },
    AudioContext: class {
      currentTime = 0;
      state = 'running';
      sampleRate = 48000;
      destination = {};
      createBufferSource = () => ({
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
        buffer: null,
        onEnded: null,
      });
      createBuffer = () => ({ copyToChannel() {}, getChannelData: () => new Float32Array(0) });
      decodeAudioData = async () => ({});
      decodeAudioDataSource = async () => ({});
      resume() {}
      close() {}
    },
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (o: any) => o.android },
  PermissionsAndroid: {
    PERMISSIONS: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO' },
    RESULTS: { GRANTED: 'granted' },
    request: async () => 'granted',
  },
}));

import {
  __resetSharedAudioContextForTests,
  __resetSharedAudioRecorderForTests,
} from '@/Audio';
import { getVoiceMicAdapter } from '../useVoiceAnalysis';
import { registerVoiceMicAdapter, unregisterVoiceMicAdapter } from '../voiceMicAdapter';
import { DECIMATION, SAMPLE_RATE } from '../voiceDsp';

const CAPTURE_SR = SAMPLE_RATE * DECIMATION; // 48 000

beforeEach(() => {
  jest.useFakeTimers();
  mockRecorders.length = 0;
  mockCallbacks.length = 0;
  __resetSharedAudioRecorderForTests();
  __resetSharedAudioContextForTests();
  registerVoiceMicAdapter();
});

afterEach(() => {
  unregisterVoiceMicAdapter();
  jest.useRealTimers();
});

/** Arranca la toma y devuelve el recorder nativo simulado ya en marcha. */
const beginTake = async () => {
  const adapter = getVoiceMicAdapter()!;
  const started = adapter.startRecording();
  // `startRecording` espera al permiso: hay que dejar correr las microtareas.
  await jest.advanceTimersByTimeAsync(0);
  await started;
  return { adapter, native: mockRecorders[0] };
};

/** Cierra la toma dejando pasar el vaciado de cola (`TAIL_DRAIN_MS`). */
const endTake = async (adapter: ReturnType<typeof getVoiceMicAdapter>) => {
  const stopping = adapter!.stopRecording();
  await jest.advanceTimersByTimeAsync(500);
  return stopping;
};

describe('ruta real del micrófono, del motor nativo al PCM devuelto', () => {
  it('una toma larga devuelve audio', async () => {
    const { adapter, native } = await beginTake();
    // 5 s de voz a 48 kHz, entregados en trozos de 20 ms como haría Oboe.
    for (let i = 0; i < 250; i++) native.feed(CAPTURE_SR * 0.02);
    const pcm = await endTake(adapter);
    expect(pcm.length).toBeGreaterThan(0);
  });

  it('CONSERVA la cola: lo que el motor vacía en stop() no puede perderse', async () => {
    const { adapter, native } = await beginTake();
    // 250 ms: dos bloques completos de 100 ms + 50 ms que se quedan en el
    // buffer circular y que el nativo solo entrega al parar.
    native.feed(CAPTURE_SR * 0.25);
    const pcm = await endTake(adapter);
    // 250 ms a 16 kHz efectivos = 4000 muestras. Si la cola se descarta solo
    // llegan 3200 (200 ms) y se pierde el final de la emisión del niño.
    expect(pcm.length).toBe(Math.round(SAMPLE_RATE * 0.25));
  });

  it('una toma MÁS CORTA que un bloque no puede devolver audio vacío', async () => {
    const { adapter, native } = await beginTake();
    // 60 ms: por debajo del bloque de 100 ms, así que el motor NO emite nada
    // hasta el vaciado de stop(). Es el caso de una emisión breve —una vocal
    // corta de un niño pequeño— y hoy se pierde entera.
    native.feed(CAPTURE_SR * 0.06);
    const pcm = await endTake(adapter);
    expect(pcm.length).toBeGreaterThan(0);
  });

  it('la pantalla se entera de que hubo señal', async () => {
    const { adapter, native } = await beginTake();
    native.feed(CAPTURE_SR * 0.25);
    await endTake(adapter);
    expect(adapter.hasSignal?.()).toBe(true);
  });
});
