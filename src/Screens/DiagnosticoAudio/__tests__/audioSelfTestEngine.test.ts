/* -------------------------------------------------------------------------- */
/*  La comprobación, de extremo a extremo, contra un motor nativo simulado.    */
/*                                                                             */
/*  Recorre el MISMO camino que en el dispositivo (micrófono compartido real,  */
/*  no un doble del adaptador), porque lo que hay que garantizar es que la     */
/*  pantalla de diagnóstico no repita el pecado que viene a corregir: dar por  */
/*  bueno un eslabón que no ha comprobado.                                     */
/* -------------------------------------------------------------------------- */

const mockBlocks: Array<(ev: unknown) => void> = [];
const mockState = { constructed: 0, started: 0 };

jest.mock('react-native-audio-api', () => {
  class FakeRecorder {
    constructor() {
      mockState.constructed += 1;
    }
    onAudioReady(cb: (ev: unknown) => void) {
      mockBlocks.push(cb);
    }
    start() {
      mockState.started += 1;
    }
    stop() {}
  }
  return {
    AudioRecorder: FakeRecorder,
    AudioContext: class {
      currentTime = 0;
      state = 'running';
      sampleRate = 48000;
      destination = {};
      createOscillator = () => ({
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
        frequency: { setValueAtTime() {} },
      });
      createGain = () => ({
        connect() {},
        disconnect() {},
        gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
      });
      resume() {}
      close() {}
    },
    AudioManager: {
      setAudioSessionOptions() {},
      setAudioSessionActivity: async () => true,
      requestRecordingPermissions: async () => 'Granted',
    },
  };
});

import {
  __resetSharedAudioContextForTests,
  __resetSharedAudioRecorderForTests,
  setRecorderPermissionGranted,
} from '@/Audio';
import {
  CAPTURE_PROBE_MS,
  checkMicCapture,
  checkMicPermission,
  checkNativeEngine,
  checkOutputContext,
  playTestTone,
} from '../audioSelfTest';

/** Entrega un bloque de audio como haría el motor nativo. */
const emit = (fill: (i: number) => number, n = 4800) => {
  const data = Float32Array.from({ length: n }, (_, i) => fill(i));
  for (const cb of mockBlocks) cb({ buffer: { getChannelData: () => data } });
};

/** Corre la comprobación de captura entregando bloques mientras dura la toma. */
const runCapture = async (fill: ((i: number) => number) | null, blocks: number) => {
  const promise = checkMicCapture();
  // El `await` de arriba cede el turno: para cuando volvemos aquí, la toma ya
  // está arrancada y suscrita.
  await Promise.resolve();
  await Promise.resolve();
  if (fill) for (let b = 0; b < blocks; b++) emit(fill);
  jest.advanceTimersByTime(CAPTURE_PROBE_MS + 10);
  return promise;
};

beforeEach(() => {
  jest.useFakeTimers();
  mockBlocks.length = 0;
  mockState.constructed = 0;
  mockState.started = 0;
  __resetSharedAudioRecorderForTests();
  __resetSharedAudioContextForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('comprobación del motor y la salida', () => {
  it('reconoce un binario con el motor nativo completo', () => {
    const r = checkNativeEngine();
    expect(r.status).toBe('ok');
    expect(r.detail).toMatch(/AudioRecorder/);
  });

  it('abre el contexto de salida y publica su frecuencia', () => {
    const r = checkOutputContext();
    expect(r.status).toBe('ok');
    expect(r.detail).toMatch(/48000 Hz/);
  });

  it('el tono de prueba llega a programarse', () => {
    expect(playTestTone()).toBe(true);
  });
});

describe('comprobación del micrófono', () => {
  it('un permiso denegado se declara FALLO y no abre el stream', async () => {
    const r = await checkMicPermission(async () => false);
    expect(r.status).toBe('fail');
    // Lo importante: sin permiso NO se construye el recorder. El stream nativo
    // se abre en el constructor, y uno creado sin permiso nace mudo para
    // siempre (es el fallo que envenenaba el micrófono del resto de módulos).
    expect(mockState.constructed).toBe(0);
  });

  it('detecta el stream MUDO: permiso concedido y ni un bloque', async () => {
    setRecorderPermissionGranted(true);
    const r = await runCapture(null, 0);
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/NI UN bloque/);
  });

  it('detecta el silencio digital: llegan bloques, todas las muestras a cero', async () => {
    setRecorderPermissionGranted(true);
    const r = await runCapture(() => 0, 10);
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/TODAS valen cero/);
  });

  it('con señal real da CORRECTO y publica el nivel medido', async () => {
    setRecorderPermissionGranted(true);
    const r = await runCapture(i => 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000), 10);
    expect(r.status).toBe('ok');
    expect(r.detail).toMatch(/10 bloques/);
    expect(r.detail).toMatch(/-6\.0 dBFS/);
  });

  it('la comprobación SUELTA el micrófono al terminar (no lo deja tomado)', async () => {
    setRecorderPermissionGranted(true);
    await runCapture(() => 0.2, 5);
    const { recorderRefCount, isRecordingSessionActive } = require('@/Audio');
    expect(recorderRefCount()).toBe(0);
    expect(isRecordingSessionActive()).toBe(false);
  });
});
