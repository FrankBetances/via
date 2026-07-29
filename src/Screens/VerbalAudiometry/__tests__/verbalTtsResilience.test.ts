/* -------------------------------------------------------------------------- */
/*  Resiliencia del arranque del motor de voz del sistema.                     */
/*                                                                             */
/*  Regresión del bug de campo «ningún motor de voz funciona». La versión      */
/*  anterior arrancaba el TTS dentro de un ÚNICO `try`: si `getInitStatus()`   */
/*  rechazaba —cosa normal en el arranque en frío de Android, donde el         */
/*  TextToSpeech tarda en estar listo— o si `voices()` fallaba, se abortaba    */
/*  entero, `ttsSpanishReady` quedaba en `false` PARA SIEMPRE y no había ni    */
/*  reintento ni aviso. Un fallo transitorio en el primer segundo de vida de   */
/*  la app dejaba la batería entera muda.                                      */
/* -------------------------------------------------------------------------- */

jest.mock('react-native-audio-api', () => {
  class FakeParam {
    value = 0;
    setValueAtTime = jest.fn();
    linearRampToValueAtTime = jest.fn();
  }
  class FakeNode {
    gain = new FakeParam();
    pan = new FakeParam();
    buffer: unknown = null;
    connect = jest.fn();
    disconnect = jest.fn();
    start = jest.fn();
    stop = jest.fn();
  }
  class FakeContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createBufferSource = () => new FakeNode();
    createGain = () => new FakeNode();
    createStereoPanner = () => new FakeNode();
    decodeAudioData = jest.fn(async () => ({ duration: 1 }));
    decodeAudioDataSource = jest.fn(async () => ({ duration: 1 }));
    resume = jest.fn();
    close = jest.fn();
  }
  return {
    AudioContext: FakeContext,
    AudioManager: { setAudioSessionOptions: jest.fn(), setAudioSessionActivity: jest.fn() },
  };
});

const SPANISH_VOICE = {
  id: 'es-es-x-eed-local',
  language: 'es-ES',
  quality: 400,
  networkConnectionRequired: false,
  notInstalled: false,
};
const BASQUE_VOICE = {
  id: 'eu-es-x-eud-local',
  language: 'eu-ES',
  quality: 400,
  networkConnectionRequired: false,
  notInstalled: false,
};

jest.mock('react-native-tts', () => {
  const tts = {
    getInitStatus: jest.fn(async () => 'success'),
    setDefaultRate: jest.fn(async () => 'success'),
    setDefaultPitch: jest.fn(async () => 'success'),
    setDefaultLanguage: jest.fn(async () => 'success'),
    setDefaultVoice: jest.fn(async () => 'success'),
    voices: jest.fn(async () => [SPANISH_VOICE]),
    speak: jest.fn(async () => 'utterance-id'),
    stop: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  return { __esModule: true, default: tts };
});

import { getVerbalAudioAdapter, installVerbalAudioAdapter } from '../verbalAudiometryAudio';

const Tts = (jest.requireMock('react-native-tts') as { default: any }).default;

const flush = () => new Promise<void>(res => setTimeout(res, 0));
/** El arranque reintenta con 700 ms de espera; 3 intentos = ~1.4 s. */
const settle = () => new Promise<void>(res => setTimeout(res, 2600));

jest.setTimeout(20000);

describe('arranque del motor de voz', () => {
  let cleanup: (() => void) | null = null;

  const install = async (wait = flush) => {
    cleanup = installVerbalAudioAdapter({ preferTts: true, assetBase64: () => null });
    await wait();
    return getVerbalAudioAdapter()!;
  };

  beforeEach(() => {
    for (const fn of [
      Tts.getInitStatus,
      Tts.setDefaultLanguage,
      Tts.setDefaultVoice,
      Tts.voices,
      Tts.speak,
    ]) {
      fn.mockClear();
    }
    Tts.getInitStatus.mockImplementation(async () => 'success');
    Tts.setDefaultLanguage.mockImplementation(async () => 'success');
    Tts.setDefaultVoice.mockImplementation(async () => 'success');
    Tts.voices.mockImplementation(async () => [SPANISH_VOICE]);
    Tts.speak.mockImplementation(async () => 'utterance-id');
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it('con el motor sano queda listo y lo declara', async () => {
    const adapter = await install();
    expect(adapter.ttsReady?.()).toBe(true);
    expect(adapter.ttsStatus?.().phase).toBe('ready');
  });

  it('un fallo TRANSITORIO de getInitStatus se reintenta en vez de darse por vencido', async () => {
    // Arranque en frío de Android: el motor todavía no está inicializado.
    Tts.getInitStatus.mockRejectedValueOnce(new Error('not ready'));
    const adapter = await install(settle);
    expect(Tts.getInitStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(adapter.ttsStatus?.().phase).toBe('ready');
    expect(adapter.ttsReady?.()).toBe(true);
  });

  it('que el motor no enumere voces NO es un fallo: se dicta por etiqueta de idioma', async () => {
    // Antes, un `voices()` que lanzaba abortaba todo el arranque y la app se
    // quedaba muda pese a tener un TTS perfectamente utilizable.
    Tts.voices.mockRejectedValue(new Error('not supported'));
    const adapter = await install();
    expect(adapter.ttsStatus?.().phase).toBe('ready');
    expect(Tts.setDefaultLanguage).toHaveBeenCalledWith('es-ES');
  });

  it('sin voz castellana pero con voz vasca, el motor queda operativo', async () => {
    // El arranque probaba SOLO el castellano: un dispositivo con voz vasca (o
    // gallega) y sin datos de español se declaraba «sin voz».
    Tts.voices.mockImplementation(async () => [BASQUE_VOICE]);
    Tts.setDefaultLanguage.mockImplementation(async (tag: string) => {
      if (tag === 'es-ES') throw new Error('idioma no disponible');
      return 'success';
    });
    const adapter = await install();
    expect(adapter.ttsStatus?.().phase).toBe('ready');
    expect(adapter.ttsReady?.()).toBe(true);
  });

  it('sin motor instalado lo dice con una acción concreta, y permite reintentar', async () => {
    Tts.getInitStatus.mockRejectedValue(Object.assign(new Error('no engine'), { code: 'no_engine' }));
    const adapter = await install(settle);
    expect(adapter.ttsStatus?.().phase).toBe('unavailable');
    // El aviso debe decir QUÉ hacer, no solo que no hay voz.
    expect(adapter.ttsStatus?.().detail).toMatch(/instale/i);

    // El profesional instala el motor y pulsa «reintentar».
    Tts.getInitStatus.mockImplementation(async () => 'success');
    await expect(adapter.retryTts?.()).resolves.toBe(true);
    expect(adapter.ttsStatus?.().phase).toBe('ready');
  });

  it('un código de idioma negativo de Android no se toma por éxito', async () => {
    // `setDefaultLanguage` resuelve con un número negativo cuando al idioma le
    // faltan datos; el `await` no rechaza, así que hay que mirar el valor.
    Tts.voices.mockImplementation(async () => []);
    Tts.setDefaultLanguage.mockImplementation(async () => -2);
    const adapter = await install();
    expect(adapter.ttsStatus?.().phase).toBe('unavailable');
    expect(adapter.ttsReady?.()).toBe(false);
  });

  it('notifica a la UI cuando cambia el estado', async () => {
    Tts.getInitStatus.mockRejectedValue(new Error('no engine'));
    const adapter = await install(settle);
    const listener = jest.fn();
    const unsubscribe = adapter.onTtsStatusChange?.(listener);
    Tts.getInitStatus.mockImplementation(async () => 'success');
    await adapter.retryTts?.();
    expect(listener).toHaveBeenCalled();
    unsubscribe?.();
  });

  it('una consigna pedida ANTES de que el motor esté listo no se pierde', async () => {
    // `speakText` se descartaba en silencio si llegaba durante el arranque:
    // justo lo que pasa con la primera consigna de un mini-juego.
    let releaseInit: (() => void) | null = null;
    Tts.getInitStatus.mockImplementation(
      () => new Promise(resolve => { releaseInit = () => resolve('success'); }),
    );
    const adapter = await install();
    adapter.speakText?.('Escucha con atención', 'es');
    expect(Tts.speak).not.toHaveBeenCalled(); // todavía arrancando

    releaseInit!();
    await flush();
    await flush();
    expect(Tts.speak).toHaveBeenCalledWith('Escucha con atención', expect.anything());
  });
});
