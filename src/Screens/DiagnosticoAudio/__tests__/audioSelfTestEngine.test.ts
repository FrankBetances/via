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
/* Reloj del hardware simulado. En el motor real `currentTime` solo avanza
 * dentro del callback con el que Oboe pide muestras, así que aquí es un valor
 * que la prueba mueve a mano: un reloj parado ES el fallo que se busca. */
const mockClock = { time: 0 };

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
      get currentTime() {
        return mockClock.time;
      }
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
  acquireRecordingSession,
  setRecorderPermissionGranted,
} from '@/Audio';
import {
  CAPTURE_PROBE_MS,
  checkMicCapture,
  checkMicPermission,
  checkNativeEngine,
  checkOutputClock,
  checkOutputContext,
  CLOCK_PROBE_MS,
  playTestTone,
  probeOutputClock,
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
  mockClock.time = 0;
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

  it('una captura abierta no ciega la comprobación del contexto de salida', () => {
    // En Android la sesión ni se toca (`AudioAPIModule.kt:66` es un no-op), y
    // en iOS atenúa pero no apaga: quien lo menciona es el eslabón del reloj.
    const release = acquireRecordingSession();
    const r = checkOutputContext();
    expect(r.status).toBe('ok');
    release();
  });

  /* -------------------------------------------------------------------- */
  /*  El reloj del hardware: la única prueba MÁQUINA de que el motor emite. */
  /*  `currentTime` sale de `currentSampleFrame_`, que solo crece dentro de */
  /*  `AudioDestinationNode::renderAudio`, a la que solo se llega desde el  */
  /*  callback de Oboe. Reloj parado = el hardware no pide muestras.        */
  /* -------------------------------------------------------------------- */

  it('probeOutputClock mide el avance real del reloj', async () => {
    const promise = probeOutputClock(200);
    // El motor entrega muestras mientras corre la ventana.
    setTimeout(() => {
      mockClock.time = 0.2;
    }, 100);
    jest.advanceTimersByTime(210);
    const probe = await promise;

    expect(probe.measured).toBe(true);
    expect(probe.advancing).toBe(true);
    expect(probe.deltaTime).toBeCloseTo(0.2, 3);
    expect(probe.ratio).toBeCloseTo(1, 1);
  });

  it('checkOutputClock FALLA cuando el reloj no avanza (stream de Oboe mudo)', async () => {
    const promise = checkOutputClock();
    jest.advanceTimersByTime(CLOCK_PROBE_MS + 10);
    const r = await promise;

    expect(r.id).toBe('output-clock');
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/NO avanzó/);
    expect(r.hint).toMatch(/no está entregando muestras/);
  });

  it('checkOutputClock da CORRECTO cuando el hardware pide muestras', async () => {
    const promise = checkOutputClock();
    setTimeout(() => {
      mockClock.time = CLOCK_PROBE_MS / 1000;
    }, 100);
    jest.advanceTimersByTime(CLOCK_PROBE_MS + 10);
    const r = await promise;

    expect(r.status).toBe('ok');
    expect(r.detail).toMatch(/pidiendo muestras/);
  });

  it('checkOutputClock AVISA si el reloj avanza a trompicones', async () => {
    const promise = checkOutputClock();
    // Un cuarto de la ventana: el motor entrega, pero se queda corto.
    setTimeout(() => {
      mockClock.time = CLOCK_PROBE_MS / 4000;
    }, 100);
    jest.advanceTimersByTime(CLOCK_PROBE_MS + 10);
    const r = await promise;

    expect(r.status).toBe('warn');
    expect(r.hint).toMatch(/troceado/);
  });

  it('checkOutputClock nombra la captura abierta sin convertirla en veredicto', async () => {
    const release = acquireRecordingSession();
    const promise = checkOutputClock();
    setTimeout(() => {
      mockClock.time = CLOCK_PROBE_MS / 1000;
    }, 100);
    jest.advanceTimersByTime(CLOCK_PROBE_MS + 10);
    const r = await promise;
    release();

    expect(r.status).toBe('ok');
    expect(r.detail).toMatch(/captura de micrófono abierta/);
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
