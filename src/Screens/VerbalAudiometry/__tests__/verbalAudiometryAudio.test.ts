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

jest.mock('react-native-tts', () => {
  const listeners: Record<string, Array<(ev?: unknown) => void>> = {};
  const tts = {
    getInitStatus: jest.fn(async () => 'success'),
    setDefaultRate: jest.fn(async () => 'success'),
    setDefaultPitch: jest.fn(async () => 'success'),
    setDefaultLanguage: jest.fn(async () => 'success'),
    setDefaultVoice: jest.fn(async () => 'success'),
    voices: jest.fn(async () => [
      { id: 'es-es-x-eed-local', language: 'es-ES', quality: 400, networkConnectionRequired: false, notInstalled: false },
    ]),
    speak: jest.fn(async () => 'utterance-id'),
    stop: jest.fn(),
    addEventListener: jest.fn((type: string, fn: (ev?: unknown) => void) => {
      (listeners[type] ??= []).push(fn);
    }),
    removeEventListener: jest.fn((type: string, fn: (ev?: unknown) => void) => {
      listeners[type] = (listeners[type] ?? []).filter(f => f !== fn);
    }),
    /** Emite un evento del motor nativo hacia los listeners registrados. */
    __emit: (type: string, ev?: unknown) => (listeners[type] ?? []).slice().forEach(f => f(ev)),
  };
  return { __esModule: true, default: tts };
});

import { installVerbalAudioAdapter, getVerbalAudioAdapter } from '../verbalAudiometryAudio';

const audioApi = jest.requireMock('react-native-audio-api') as { __starts: unknown[] };
const Tts = (jest.requireMock('react-native-tts') as { default: any }).default;

/** Deja drenar las cadenas de promesas pendientes (configureTts, decodeClip…). */
const flush = () => new Promise<void>(res => setTimeout(() => res(), 0));

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
    Tts.speak.mockClear();
    Tts.speak.mockImplementation(async () => 'utterance-id');
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

  it('si speak() rechaza (p. ej. voz de red sin conexión), la palabra suena por el recorte', async () => {
    const adapter = await install();
    Tts.speak.mockRejectedValueOnce(new Error('network_error'));
    adapter.playWord('pato', 'pato', 65);
    await flush();
    expect(audioApi.__starts).toHaveLength(1);
  });

  it('un fallo asíncrono (evento tts-error) también degrada la palabra al recorte', async () => {
    const adapter = await install();
    adapter.playWord('gato', 'gato', 65);
    await flush();
    expect(audioApi.__starts).toHaveLength(0); // el dictado se encoló bien
    Tts.__emit('tts-error', { utteranceId: 'utterance-id' });
    await flush();
    expect(audioApi.__starts).toHaveLength(1); // …pero al fallar suena el recorte
  });

  it('tras dos fallos seguidos deja de intentar el TTS y usa recortes directamente', async () => {
    const adapter = await install();
    Tts.speak.mockRejectedValue(new Error('network_error'));
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

  it('tts-finish resetea el contador de fallos (un fallo aislado no degrada la sesión)', async () => {
    const adapter = await install();
    Tts.speak.mockRejectedValueOnce(new Error('network_error'));
    adapter.playWord('pato', 'pato', 65);
    await flush(); // 1 fallo (suena recorte)

    adapter.playWord('gato', 'gato', 65);
    await flush();
    Tts.__emit('tts-finish', { utteranceId: 'utterance-id' }); // dictado completado

    Tts.speak.mockRejectedValueOnce(new Error('network_error'));
    adapter.playWord('casa', 'casa', 65);
    await flush(); // otro fallo aislado: sigue sin llegar al límite

    Tts.speak.mockClear();
    adapter.playWord('taza', 'taza', 65);
    await flush();
    expect(Tts.speak).toHaveBeenCalled(); // el TTS sigue siendo la vía primaria
  });

  it('una detención deliberada (stop) no dispara el recorte de respaldo', async () => {
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65);
    await flush();
    adapter.stop(); // el niño respondió: se corta el estímulo a propósito
    Tts.__emit('tts-error', { utteranceId: 'utterance-id' });
    await flush();
    expect(audioApi.__starts).toHaveLength(0);
  });
});
