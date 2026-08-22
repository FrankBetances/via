/* -------------------------------------------------------------------------- */
/*  Resiliencia del arranque del motor de voz del sistema.                     */
/*                                                                             */
/*  Regresión del bug de campo «ningún motor de voz funciona».                 */
/*                                                                             */
/*  Con `react-native-tts` el arranque tenía fases que podían fallar           */
/*  (`getInitStatus`, `voices`, `setDefaultVoice`, `setDefaultLanguage`) y     */
/*  cualquiera de ellas dejaba la app MUDA para toda la sesión. Migrado a      */
/*  `expo-speech` —el motor de Valeria+— esas fases desaparecen: la voz se     */
/*  elige por locución y la elección es una PREFERENCIA, no una puerta.        */
/*                                                                             */
/*  Lo que se vigila aquí es precisamente eso: que NINGUNA forma de fallo al   */
/*  enumerar voces pueda volver a enmudecer la app. Mientras el módulo de      */
/*  síntesis exista, se dicta.                                                 */
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
  identifier: 'es-es-x-eed-local',
  name: 'Español (España)',
  language: 'es-ES',
  quality: 'Enhanced',
};
const BASQUE_VOICE = {
  identifier: 'eu-es-x-eud-local',
  name: 'Euskara',
  language: 'eu-ES',
  quality: 'Enhanced',
};

jest.mock('expo-speech', () => ({
  speak: jest.fn((_text: string, opts: any) => {
    setTimeout(() => opts?.onDone?.(), 0);
  }),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => [
    {
      identifier: 'es-es-x-eed-local',
      name: 'Español (España)',
      language: 'es-ES',
      quality: 'Enhanced',
    },
  ]),
}));

import { getVerbalAudioAdapter, installVerbalAudioAdapter } from '../verbalAudiometryAudio';

const Tts = jest.requireMock('expo-speech') as any;

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise<void>(res => setTimeout(res, 0));
};

describe('arranque del motor de voz', () => {
  let cleanup: (() => void) | null = null;

  const install = async () => {
    cleanup = installVerbalAudioAdapter({ preferTts: true, assetBase64: () => null });
    await flush();
    return getVerbalAudioAdapter()!;
  };

  beforeEach(() => {
    Tts.speak.mockReset();
    Tts.speak.mockImplementation((_text: string, opts: any) => {
      setTimeout(() => opts?.onDone?.(), 0);
    });
    Tts.stop.mockReset();
    Tts.getAvailableVoicesAsync.mockReset();
    Tts.getAvailableVoicesAsync.mockImplementation(async () => [SPANISH_VOICE]);
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

  it('si enumerar las voces LANZA, el motor sigue operativo', async () => {
    // Éste es el caso que enmudecía la app: con `react-native-tts`, un
    // `voices()` que fallaba abortaba el arranque entero. Y no era hipotético:
    // su implementación de `voices()` en Android lanza NullPointerException con
    // voces sin país (comparación de referencias `country != ""` y `map.get()`
    // sin comprobar null), devolviendo la lista truncada o vacía.
    Tts.getAvailableVoicesAsync.mockRejectedValue(new Error('not supported'));
    const adapter = await install();
    expect(adapter.ttsStatus?.().phase).toBe('ready');
    expect(adapter.ttsReady?.()).toBe(true);
  });

  it('una lista de voces VACÍA tampoco es un fallo: se dicta por etiqueta de idioma', async () => {
    Tts.getAvailableVoicesAsync.mockImplementation(async () => []);
    const adapter = await install();
    expect(adapter.ttsStatus?.().phase).toBe('ready');

    adapter.speakText?.('hola', 'es');
    await flush();
    expect(Tts.speak).toHaveBeenCalledWith('hola', expect.objectContaining({ language: 'es-ES' }));
  });

  it('sin voz castellana pero con voz vasca, el motor queda operativo', async () => {
    // El arranque antiguo probaba SOLO el castellano: un dispositivo con voz
    // vasca (o gallega) y sin datos de español se declaraba «sin voz».
    Tts.getAvailableVoicesAsync.mockImplementation(async () => [BASQUE_VOICE]);
    const adapter = await install();
    expect(adapter.ttsStatus?.().phase).toBe('ready');
    expect(adapter.ttsReady?.()).toBe(true);

    adapter.speakText?.('kaixo', 'eu');
    await flush();
    expect(Tts.speak).toHaveBeenCalledWith(
      'kaixo',
      expect.objectContaining({ voice: BASQUE_VOICE.identifier }),
    );
  });

  it('la voz elegida es la del idioma pedido, no la que quedó cargada antes', async () => {
    // Con el modelo anterior la voz se FIJABA en el motor y persistía: una
    // sesión gallega dictaba con la voz castellana ya cargada. Ahora la voz
    // viaja en cada locución, así que no hay estado que se quede pegado.
    Tts.getAvailableVoicesAsync.mockImplementation(async () => [SPANISH_VOICE, BASQUE_VOICE]);
    const adapter = await install();

    adapter.speakText?.('hola', 'es');
    await flush();
    expect(Tts.speak).toHaveBeenLastCalledWith(
      'hola',
      expect.objectContaining({ voice: SPANISH_VOICE.identifier }),
    );

    adapter.speakText?.('kaixo', 'eu');
    await flush();
    expect(Tts.speak).toHaveBeenLastCalledWith(
      'kaixo',
      expect.objectContaining({ voice: BASQUE_VOICE.identifier }),
    );
  });

  it('notifica a la UI cuando cambia el estado', async () => {
    const adapter = await install();
    const listener = jest.fn();
    const unsubscribe = adapter.onTtsStatusChange?.(listener);
    await adapter.retryTts?.();
    expect(listener).toHaveBeenCalled();
    unsubscribe?.();
  });

  it('una consigna pedida ANTES de que el motor esté listo no se pierde', async () => {
    // `speakText` se descartaba en silencio si llegaba durante el arranque:
    // justo lo que pasa con la primera consigna de un mini-juego.
    let releaseVoices: (() => void) | null = null;
    Tts.getAvailableVoicesAsync.mockImplementation(
      () =>
        new Promise(resolve => {
          releaseVoices = () => resolve([SPANISH_VOICE]);
        }),
    );
    cleanup = installVerbalAudioAdapter({ preferTts: true, assetBase64: () => null });
    const adapter = getVerbalAudioAdapter()!;

    adapter.speakText?.('Escucha con atención', 'es');
    await flush();
    expect(Tts.speak).not.toHaveBeenCalled(); // todavía enumerando

    releaseVoices!();
    await flush();
    expect(Tts.speak).toHaveBeenCalledWith('Escucha con atención', expect.anything());
  });
});
