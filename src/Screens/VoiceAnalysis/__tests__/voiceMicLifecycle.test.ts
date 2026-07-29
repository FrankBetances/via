/* -------------------------------------------------------------------------- */
/*  Ciclo de vida del AudioRecorder (bug «el micrófono no captura»).           */
/*                                                                             */
/*  `AudioRecorder` de react-native-audio-api 0.8 abre el stream nativo en el  */
/*  CONSTRUCTOR y no expone `close()`: el stream solo se cierra cuando el GC   */
/*  libera el host object, y `stop()` se limita a `requestStop()`. Construir   */
/*  uno por grabación dejaba streams de entrada abiertos acumulándose; cuando  */
/*  la apertura del siguiente fallaba, el constructor nativo se lo tragaba     */
/*  (ignora el `Result` de `openStream`) y `start()` no hacía nada ni lanzaba. */
/*  De ahí «el micrófono no captura y no se genera nada», sin ningún error.    */
/* -------------------------------------------------------------------------- */

const mockConstructed: any[] = [];
const mockSubscriptions: Array<(ev: unknown) => void> = [];

jest.mock('react-native-audio-api', () => {
  class FakeRecorder {
    public started = 0;
    public stopped = 0;
    constructor() {
      mockConstructed.push(this);
    }
    onAudioReady(cb: (ev: unknown) => void) {
      mockSubscriptions.push(cb);
    }
    start() {
      this.started += 1;
    }
    stop() {
      this.stopped += 1;
    }
  }
  class FakeNode {
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
    createBuffer = () => ({ copyToChannel: jest.fn(), getChannelData: () => new Float32Array(0) });
    decodeAudioData = jest.fn();
    decodeAudioDataSource = jest.fn();
    resume = jest.fn();
    close = jest.fn();
  }
  return {
    AudioRecorder: FakeRecorder,
    AudioContext: FakeContext,
    AudioManager: {
      setAudioSessionOptions: jest.fn(),
      setAudioSessionActivity: jest.fn(),
      requestRecordingPermissions: jest.fn(async () => 'Granted'),
    },
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  PermissionsAndroid: { request: jest.fn(), PERMISSIONS: {}, RESULTS: {} },
}));

import { getVoiceMicAdapter } from '../useVoiceAnalysis';
import { registerVoiceMicAdapter, unregisterVoiceMicAdapter } from '../voiceMicAdapter';

/** Bloque PCM de 100 ms a 48 kHz con una señal cualquiera. */
const block = () => {
  const pcm = new Float32Array(4800);
  for (let i = 0; i < pcm.length; i++) pcm[i] = 0.1 * Math.sin((2 * Math.PI * 200 * i) / 48000);
  return { buffer: { getChannelData: () => pcm } };
};

const emit = () => mockSubscriptions.forEach(cb => cb(block()));

describe('voiceMicAdapter · un único recorder por adaptador', () => {
  beforeEach(() => {
    mockConstructed.length = 0;
    mockSubscriptions.length = 0;
    registerVoiceMicAdapter();
  });

  afterEach(() => unregisterVoiceMicAdapter());

  it('varias tomas seguidas REUTILIZAN el mismo stream nativo', async () => {
    const adapter = getVoiceMicAdapter()!;
    for (let i = 0; i < 4; i++) {
      await adapter.startRecording();
      emit();
      await adapter.stopRecording();
    }
    // Antes se construía uno por toma y los anteriores quedaban abiertos.
    expect(mockConstructed).toHaveLength(1);
    expect(mockConstructed[0].started).toBe(4);
  });

  it('registra UNA sola suscripción de audio, no una por grabación', async () => {
    const adapter = getVoiceMicAdapter()!;
    for (let i = 0; i < 3; i++) {
      await adapter.startRecording();
      await adapter.stopRecording();
    }
    expect(mockSubscriptions).toHaveLength(1);
  });

  it('la cuarta toma sigue capturando audio (no se queda muda)', async () => {
    const adapter = getVoiceMicAdapter()!;
    let pcm = new Float32Array(0);
    for (let i = 0; i < 4; i++) {
      await adapter.startRecording();
      for (let b = 0; b < 10; b++) emit();
      pcm = await adapter.stopRecording();
    }
    expect(pcm.length).toBeGreaterThan(0);
  });

  it('fuera de una toma, los bloques del stream no se acumulan', async () => {
    const adapter = getVoiceMicAdapter()!;
    emit(); // stream vivo pero sin grabación en curso
    emit();
    await adapter.startRecording();
    for (let b = 0; b < 5; b++) emit();
    const pcm = await adapter.stopRecording();
    // Solo los 5 bloques de la toma, no los 2 anteriores.
    const perBlock = pcm.length / 5;
    expect(Math.round(perBlock)).toBe(1600); // 4800 muestras ÷ 3 (decimación)
  });

  it('cada toma empieza limpia (no arrastra el audio de la anterior)', async () => {
    const adapter = getVoiceMicAdapter()!;
    await adapter.startRecording();
    for (let b = 0; b < 8; b++) emit();
    const first = await adapter.stopRecording();

    await adapter.startRecording();
    for (let b = 0; b < 3; b++) emit();
    const second = await adapter.stopRecording();

    expect(first.length).toBeGreaterThan(second.length);
  });
});
