/* -------------------------------------------------------------------------- */
/*  Cadena de degradación del blueprint de Valeria+ en la audiometría verbal.  */
/*                                                                             */
/*  Regresión del bug de campo «las voces no suenan»: la app estaba instalada  */
/*  con `preferTts: true`, es decir, con el sintetizador del DISPOSITIVO como  */
/*  vía primaria del estímulo clínico. En Android `speak()` resuelve al        */
/*  ENCOLAR, así que una locución que el motor descarta se daba por emitida y  */
/*  el recorte de respaldo nunca llegaba a sonar: castellano y dominicano se   */
/*  quedaban mudos aunque sus recortes estuvieran empaquetados.                */
/*                                                                             */
/*  El orden correcto (docs/design/arquitectura-corpus-voz.md §6) es: asset de */
/*  la lengua → asset base → voz del sistema → silencio.                       */
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
  class FakeNode {
    gain = new FakeParam();
    pan = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
  }
  const decodeAudioData = jest.fn(async () => ({ duration: 1 }));
  class FakeContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createBufferSource = () => new FakeSource();
    createGain = () => new FakeNode();
    createStereoPanner = () => new FakeNode();
    decodeAudioData = decodeAudioData;
    decodeAudioDataSource = jest.fn(async () => ({ duration: 1 }));
    resume = jest.fn();
    close = jest.fn();
  }
  return {
    AudioContext: FakeContext,
    AudioManager: { setAudioSessionOptions: jest.fn(), setAudioSessionActivity: jest.fn() },
    __starts: starts,
    __decodeAudioData: decodeAudioData,
  };
});

jest.mock('expo-speech', () => ({
  // `expo-speech` entrega el resultado por los callbacks de CADA locución.
  speak: jest.fn((_text: string, opts: any) => {
    setTimeout(() => opts?.onDone?.(), 0);
  }),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => [
    { identifier: 'es-es-x-eed-local', name: 'Español', language: 'es-ES', quality: 'Enhanced' },
  ]),
}));

import { getVerbalAudioAdapter, installVerbalAudioAdapter } from '../verbalAudiometryAudio';

const audioApi = jest.requireMock('react-native-audio-api') as {
  __starts: unknown[];
  __decodeAudioData: jest.Mock;
};
const Tts = jest.requireMock('expo-speech') as any;

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise<void>(res => setTimeout(res, 0));
};

/** Recorte disponible solo para las lenguas con banco de locuciones. */
const CLIP_LANGS = ['es', 'es-DO', undefined];
const assetBase64 = (_key: string, lang?: string) =>
  CLIP_LANGS.includes(lang) ? 'QUFBQQ==' : null;

describe('audiometría verbal · el recorte es la vía primaria', () => {
  let cleanup: (() => void) | null = null;

  const install = async () => {
    // Misma configuración que App.tsx.
    cleanup = installVerbalAudioAdapter({ preferTts: false, assetBase64 });
    await flush();
    return getVerbalAudioAdapter()!;
  };

  beforeEach(() => {
    audioApi.__starts.length = 0;
    audioApi.__decodeAudioData.mockClear();
    Tts.speak.mockReset();
    Tts.speak.mockImplementation((_text: string, opts: any) => {
      setTimeout(() => opts?.onDone?.(), 0);
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it('en castellano suena el RECORTE, no el sintetizador del dispositivo', async () => {
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65, 'es');
    await flush();
    expect(audioApi.__starts).toHaveLength(1);
    expect(Tts.speak).not.toHaveBeenCalled();
  });

  it('en dominicano también suena el recorte', async () => {
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65, 'es-DO');
    await flush();
    expect(audioApi.__starts).toHaveLength(1);
    expect(Tts.speak).not.toHaveBeenCalled();
  });

  it('un idioma SIN recorte para esa palabra degrada a la voz del sistema', async () => {
    // Degradación declarada y honesta: un idioma completo nunca reproduce el
    // recorte castellano en su lugar, porque sería otro estímulo.
    const adapter = await install();
    adapter.playWord('inexistente', 'ogi', 65, 'gl');
    await flush();
    expect(audioApi.__starts).toHaveLength(0);
    expect(Tts.speak).toHaveBeenCalled();
  });

  it('si el recorte no decodifica, la palabra cae a la voz del sistema', async () => {
    audioApi.__decodeAudioData.mockRejectedValueOnce(new Error('corrupto'));
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65, 'es');
    await flush();
    await flush();
    expect(audioApi.__starts).toHaveLength(0);
    expect(Tts.speak).toHaveBeenCalled();
  });

  it('prime() deja el recorte decodificado para que la primera lámina suene ya', async () => {
    // Sin precarga, la primera emisión llegaba después de decodificar y el
    // estímulo se percibía como «no ha sonado» (había que pulsar «repetir»).
    const adapter = await install();
    adapter.prime?.('pato', 'es');
    await flush();
    expect(audioApi.__decodeAudioData).toHaveBeenCalledTimes(1);

    audioApi.__decodeAudioData.mockClear();
    adapter.playWord('pato', 'pato', 65, 'es');
    // Sin await: la reproducción es SÍNCRONA porque el buffer ya está en caché.
    expect(audioApi.__starts).toHaveLength(1);
    expect(audioApi.__decodeAudioData).not.toHaveBeenCalled();
  });

  it('prime() no vuelve a decodificar lo ya cacheado', async () => {
    const adapter = await install();
    adapter.prime?.('pato', 'es');
    await flush();
    adapter.prime?.('pato', 'es');
    await flush();
    expect(audioApi.__decodeAudioData).toHaveBeenCalledTimes(1);
  });
});
