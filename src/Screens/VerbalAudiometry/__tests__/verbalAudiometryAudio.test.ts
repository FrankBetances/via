/* -------------------------------------------------------------------------- */
/*  Degradación del adaptador de audio de la Audiometría Verbal.               */
/*                                                                             */
/*  Regresión del bug de campo «la voz deja de sonar a mitad de la prueba»:    */
/*  con el TTS como vía primaria, un fallo de síntesis (voz de red sin         */
/*  conectividad) se tragaba en silencio y el recorte de respaldo prometido    */
/*  nunca sonaba. El adaptador debe degradar la palabra al recorte tanto si    */
/*  `speak()` rechaza como si el error llega asíncrono por `tts-error`, y      */
/*  tras varios fallos seguidos pasar la sesión entera a recortes.             */
/* -------------------------------------------------------------------------- */

jest.mock('react-native-audio-api', () => {
  const starts: unknown[] = [];
  class FakeParam {
    value = 0;
    setValueAtTime = jest.fn();
    linearRampToValueAtTime = jest.fn();
  }
  class FakeSource {
    buffer: unknown = null;
    connect = jest.fn();
    stop = jest.fn();
    disconnect = jest.fn();
    start = jest.fn(() => {
      starts.push(this.buffer);
    });
  }
  class FakeGain {
    gain = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
  }
  class FakePanner {
    pan = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
  }
  class FakeContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createBufferSource = () => new FakeSource();
    createGain = () => new FakeGain();
    createStereoPanner = () => new FakePanner();
    decodeAudioData = jest.fn(async () => ({ duration: 1 }));
    decodeAudioDataSource = jest.fn(async () => ({ duration: 1 }));
    resume = jest.fn();
    close = jest.fn();
  }
  return {
    AudioContext: FakeContext,
    AudioManager: {
      setAudioSessionOptions: jest.fn(),
      setAudioSessionActivity: jest.fn(),
    },
    /** Recortes efectivamente emitidos (un push por `source.start()`). */
    __starts: starts,
  };
});

jest.mock('expo-speech', () => {
  /* Réplica del contrato de `expo-speech`: las opciones de CADA locución
   * llevan sus propios `onDone` / `onError` / `onStopped`, y `stop()` cancela
   * la locución en curso disparando su `onStopped`. Ese es el cambio de modelo
   * respecto a `react-native-tts`, que emitía eventos GLOBALES y obligaba a
   * llevar estado compartido para saber a qué palabra correspondía cada uno. */
  let pending: any = null;
  const speak = jest.fn((_text: string, opts: any) => {
    pending = opts;
    setTimeout(() => {
      if (pending !== opts) return; // otra locución tomó el relevo
      pending = null;
      opts?.onDone?.();
    }, 0);
  });
  return {
    speak,
    stop: jest.fn(() => {
      const p = pending;
      pending = null;
      p?.onStopped?.();
    }),
    getAvailableVoicesAsync: jest.fn(async () => [
      { identifier: 'es-es-x-eed-local', name: 'Español', language: 'es-ES', quality: 'Enhanced' },
    ]),
    /** Hace fallar la SIGUIENTE locución, como una voz de red sin conexión. */
    __failNext: () => {
      speak.mockImplementationOnce((_t: string, o: any) => {
        setTimeout(() => o?.onError?.(new Error('network_error')), 0);
      });
    },
    /** Hace fallar TODAS las locuciones siguientes. */
    __failAlways: () => {
      speak.mockImplementation((_t: string, o: any) => {
        setTimeout(() => o?.onError?.(new Error('network_error')), 0);
      });
    },
  };
});

import { installVerbalAudioAdapter, getVerbalAudioAdapter } from '../verbalAudiometryAudio';

const audioApi = jest.requireMock('react-native-audio-api') as { __starts: unknown[] };
const Tts = jest.requireMock('expo-speech') as any;

/** Deja drenar las cadenas de promesas pendientes (configureTts, decodeClip…). */
const flush = async () => {
  // Cuatro vueltas: la degradación al recorte encadena onError → catch →
  // decodeClip (async) → playBuffer. Con una sola vuelta el aserto miraba el
  // buffer antes de que el recorte hubiera arrancado.
  for (let i = 0; i < 4; i++) await new Promise<void>(res => setTimeout(res, 0));
};

describe('verbalAudiometryAudio — degradación TTS → recortes', () => {
  let cleanup: (() => void) | null = null;

  const install = async () => {
    cleanup = installVerbalAudioAdapter({
      preferTts: true,
      assetBase64: () => 'QUFBQQ==', // recorte incrustado disponible para toda palabra
    });
    await flush(); // configureTts: voces + setDefaultVoice
    return getVerbalAudioAdapter()!;
  };

  beforeEach(() => {
    audioApi.__starts.length = 0;
    Tts.speak.mockReset();
    Tts.speak.mockImplementation((_text: string, opts: any) => {
      setTimeout(() => opts?.onDone?.(), 0);
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it('con voz española verificada dicta por TTS (vía primaria), sin recorte', async () => {
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65);
    await flush();
    expect(Tts.speak).toHaveBeenCalledWith('pato', expect.anything());
    expect(audioApi.__starts).toHaveLength(0);
  });

  it('un fallo ASÍNCRONO de la síntesis degrada esa palabra al recorte', async () => {
    // Con `expo-speech` el fallo llega por el `onError` de ESA locución, no por
    // un evento global: ya no hay que adivinar a qué palabra correspondía.
    const adapter = await install();
    Tts.__failNext();
    adapter.playWord('gato', 'gato', 65);
    await flush();
    expect(audioApi.__starts).toHaveLength(1);
  });

  it('tras dos fallos seguidos deja de intentar el TTS y usa recortes directamente', async () => {
    const adapter = await install();
    Tts.__failAlways();
    adapter.playWord('pato', 'pato', 65);
    await flush();
    adapter.playWord('gato', 'gato', 65);
    await flush();
    expect(audioApi.__starts).toHaveLength(2); // ambas degradadas a recorte

    Tts.speak.mockClear();
    adapter.playWord('casa', 'casa', 65);
    await flush();
    expect(Tts.speak).not.toHaveBeenCalled(); // sesión degradada: recortes
    expect(audioApi.__starts).toHaveLength(3);
  });

  it('una locución completada resetea el contador (un fallo aislado no degrada la sesión)', async () => {
    const adapter = await install();
    Tts.__failNext();
    adapter.playWord('pato', 'pato', 65);
    await flush(); // 1 fallo (suena recorte)

    adapter.playWord('gato', 'gato', 65);
    await flush(); // dictado completado: el contador vuelve a cero

    Tts.__failNext();
    adapter.playWord('casa', 'casa', 65);
    await flush(); // otro fallo aislado: sigue sin llegar al límite

    Tts.speak.mockClear();
    adapter.playWord('taza', 'taza', 65);
    await flush();
    expect(Tts.speak).toHaveBeenCalled(); // el TTS sigue siendo la vía primaria
  });

  it('una detención deliberada (stop) no dispara el recorte de respaldo', async () => {
    // `expo-speech` avisa de la parada por `onStopped`, que el adaptador trata
    // como fin normal: cortar el estímulo porque el niño ya respondió no puede
    // contar como fallo de síntesis ni disparar el recorte.
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65);
    adapter.stop();
    await flush();
    expect(audioApi.__starts).toHaveLength(0);
  });
});
