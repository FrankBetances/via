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

import { __resetSharedAudioRecorderForTests, recorderHealth } from '@/Audio';
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
    // El recorder es un SINGLETON DE PROCESO (ver `sharedAudioRecorder`): sin
    // este reinicio, cada test heredaría el del anterior y `mockSubscriptions`
    // —que aquí se vacía— dejaría de tener a quién entregar los bloques.
    __resetSharedAudioRecorderForTests();
    registerVoiceMicAdapter();
  });

  afterEach(() => {
    unregisterVoiceMicAdapter();
    __resetSharedAudioRecorderForTests();
  });

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

/* -------------------------------------------------------------------------- */
/*  REGRESIÓN — «grabo, guarda el audio y luego dice captura insuficiente».    */
/*                                                                            */
/*  El stream de entrada se abre en el CONSTRUCTOR y solo se cierra en el      */
/*  destructor de C++, o sea cuando pasa el GC. La versión anterior soltaba la */
/*  referencia al bajar el recuento de reservas a cero, así que ir del T.A.R.  */
/*  al análisis de voz —o de la voz a la prosodia— construía un recorder nuevo */
/*  mientras el anterior seguía abierto en modo exclusivo: `openStream`        */
/*  fallaba, el constructor se lo tragaba y el módulo entrante capturaba       */
/*  silencio sin dar ningún error. Parecía aleatorio porque dependía del orden */
/*  de visita a los módulos.                                                   */
/* -------------------------------------------------------------------------- */
describe('micrófono compartido · singleton de proceso', () => {
  beforeEach(() => {
    mockConstructed.length = 0;
    mockSubscriptions.length = 0;
    __resetSharedAudioRecorderForTests();
  });

  afterEach(() => {
    unregisterVoiceMicAdapter();
    __resetSharedAudioRecorderForTests();
  });

  it('entrar y salir de la pantalla NO vuelve a abrir el stream nativo', async () => {
    for (let visita = 0; visita < 3; visita++) {
      registerVoiceMicAdapter();
      const adapter = getVoiceMicAdapter()!;
      await adapter.startRecording();
      emit();
      await adapter.stopRecording();
      unregisterVoiceMicAdapter(); // desmontaje de la pantalla
    }
    expect(mockConstructed).toHaveLength(1);
  });

  it('la toma de una visita posterior sigue recibiendo audio', async () => {
    registerVoiceMicAdapter();
    await getVoiceMicAdapter()!.startRecording();
    emit();
    await getVoiceMicAdapter()!.stopRecording();
    unregisterVoiceMicAdapter();

    registerVoiceMicAdapter();
    const adapter = getVoiceMicAdapter()!;
    await adapter.startRecording();
    for (let b = 0; b < 5; b++) emit();
    const pcm = await adapter.stopRecording();

    expect(pcm.length).toBeGreaterThan(0);
    expect(adapter.hasSignal?.()).toBe(true);
    expect(recorderHealth()).toBe('live');
  });

  /* El stream se abre en el constructor, así que abrirlo antes de que el
   * usuario conceda RECORD_AUDIO lo deja sin stream PARA SIEMPRE — y como el
   * micrófono es compartido, envenenaba también a los demás módulos. */
  it('no se construye ningún recorder mientras no haya permiso', () => {
    registerVoiceMicAdapter();
    expect(mockConstructed).toHaveLength(0);
    expect(recorderHealth()).toBe('unknown');
  });
});
