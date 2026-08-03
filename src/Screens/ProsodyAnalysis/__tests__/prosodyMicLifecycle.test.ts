/* -------------------------------------------------------------------------- */
/*  Micrófono COMPARTIDO entre el análisis de voz y el de prosodia.            */
/*                                                                            */
/*  El stream de entrada es exclusivo: `AudioRecorder` lo abre en el           */
/*  constructor, no expone `close()` y el constructor nativo se traga el fallo */
/*  de apertura. Dos módulos con recorder propio harían que el segundo se      */
/*  quedara mudo SIN NINGÚN ERROR, que es el fallo que ya costó caro en el     */
/*  lado de la salida y motivó `sharedAudioContext`.                          */
/*                                                                            */
/*  Lo que se vigila aquí es que, con los dos adaptadores registrados, siga    */
/*  habiendo UN solo recorder y que cada módulo reciba su audio.               */
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

import { __resetSharedAudioRecorderForTests, recorderRefCount } from '@/Audio';
import {
  registerVoiceMicAdapter,
  unregisterVoiceMicAdapter,
} from '@/Screens/VoiceAnalysis/voiceMicAdapter';
import { getVoiceMicAdapter } from '@/Screens/VoiceAnalysis/useVoiceAnalysis';
import { getProsodyMicAdapter } from '../useProsodyAnalysis';
import { registerProsodyMicAdapter, unregisterProsodyMicAdapter } from '../prosodyMicAdapter';

/** Bloque PCM de 100 ms a 48 kHz con voz sintética de 200 Hz. */
const block = () => {
  const pcm = new Float32Array(4800);
  for (let i = 0; i < pcm.length; i++) pcm[i] = 0.2 * Math.sin((2 * Math.PI * 200 * i) / 48000);
  return { buffer: { getChannelData: () => pcm } };
};

const emit = () => mockSubscriptions.forEach(cb => cb(block()));

describe('prosodyMicAdapter · ciclo de vida', () => {
  beforeEach(() => {
    mockConstructed.length = 0;
    mockSubscriptions.length = 0;
    __resetSharedAudioRecorderForTests();
  });

  afterEach(() => {
    unregisterProsodyMicAdapter();
    unregisterVoiceMicAdapter();
    __resetSharedAudioRecorderForTests();
  });

  it('varias tomas seguidas reutilizan el mismo stream nativo', async () => {
    registerProsodyMicAdapter();
    const adapter = getProsodyMicAdapter()!;
    for (let i = 0; i < 4; i++) {
      await adapter.startRecording();
      emit();
      await adapter.stopRecording();
    }
    expect(mockConstructed).toHaveLength(1);
  });

  it('registra UNA sola suscripción, no una por grabación', async () => {
    registerProsodyMicAdapter();
    const adapter = getProsodyMicAdapter()!;
    for (let i = 0; i < 3; i++) {
      await adapter.startRecording();
      await adapter.stopRecording();
    }
    expect(mockSubscriptions).toHaveLength(1);
  });

  it('fuera de una toma, los bloques del stream no se acumulan', async () => {
    registerProsodyMicAdapter();
    const adapter = getProsodyMicAdapter()!;
    emit();
    emit();
    await adapter.startRecording();
    for (let b = 0; b < 5; b++) emit();
    const pcm = await adapter.stopRecording();
    expect(Math.round(pcm.length / 5)).toBe(1600); // 4800 ÷ 3 (decimación)
  });

  it('distingue «no hay señal» de «no habló»', async () => {
    registerProsodyMicAdapter();
    const adapter = getProsodyMicAdapter()!;
    await adapter.startRecording();
    const sinAudio = await adapter.stopRecording();
    expect(adapter.hasSignal()).toBe(false);
    expect(sinAudio.length).toBe(0);

    await adapter.startRecording();
    emit();
    await adapter.stopRecording();
    expect(adapter.hasSignal()).toBe(true);
  });

  it('la realimentación en vivo cuenta habla, no reloj', async () => {
    registerProsodyMicAdapter();
    const adapter = getProsodyMicAdapter()!;
    const frames: Array<{ elapsedSec: number; speechSec: number }> = [];
    await adapter.startRecording(f => frames.push({ elapsedSec: f.elapsedSec, speechSec: f.speechSec }));
    for (let b = 0; b < 10; b++) emit();
    await adapter.stopRecording();

    expect(frames.length).toBe(10);
    // 10 bloques de 100 ms = 1 s de reloj.
    expect(frames[frames.length - 1].elapsedSec).toBeCloseTo(1, 1);
    // La señal es voz continua: casi todo cuenta como habla.
    expect(frames[frames.length - 1].speechSec).toBeGreaterThan(0.5);
  });
});

describe('micrófono compartido · dos módulos, un solo stream', () => {
  beforeEach(() => {
    mockConstructed.length = 0;
    mockSubscriptions.length = 0;
    __resetSharedAudioRecorderForTests();
  });

  afterEach(() => {
    unregisterProsodyMicAdapter();
    unregisterVoiceMicAdapter();
    __resetSharedAudioRecorderForTests();
  });

  /* REGRESIÓN — el segundo módulo se quedaba mudo.
   *
   * Con un recorder por adaptador, registrar los dos abría dos streams de
   * entrada exclusivos: el segundo fallaba en silencio y su módulo no capturaba
   * nada, sin dar ningún error. */
  it('con los dos adaptadores registrados solo se construye UN recorder', async () => {
    registerVoiceMicAdapter();
    registerProsodyMicAdapter();

    const voice = getVoiceMicAdapter()!;
    const prosody = getProsodyMicAdapter()!;
    await voice.startRecording();
    await prosody.startRecording();
    emit();

    expect(mockConstructed).toHaveLength(1);

    const voicePcm = await voice.stopRecording();
    const prosodyPcm = await prosody.stopRecording();
    // Los DOS reciben audio: el reparto es a todos los consumidores vivos.
    expect(voicePcm.length).toBeGreaterThan(0);
    expect(prosodyPcm.length).toBeGreaterThan(0);
  });

  /* La reserva del micrófono es PEREZOSA: registrar el adaptador no lo toma,
   * solo grabar. Estar en la pantalla no debe retener el micrófono —ni el
   * indicador de grabación del sistema— mientras el clínico lee la consigna. */
  it('registrar un adaptador no reserva el micrófono; grabar sí', async () => {
    registerVoiceMicAdapter();
    registerProsodyMicAdapter();
    expect(recorderRefCount()).toBe(0);

    await getVoiceMicAdapter()!.startRecording();
    expect(recorderRefCount()).toBe(1);

    await getProsodyMicAdapter()!.startRecording();
    expect(recorderRefCount()).toBe(2);
  });

  it('el recuento de reservas vuelve a cero al desregistrar ambos', async () => {
    registerVoiceMicAdapter();
    registerProsodyMicAdapter();
    await getVoiceMicAdapter()!.startRecording();
    await getProsodyMicAdapter()!.startRecording();
    expect(recorderRefCount()).toBe(2);

    unregisterVoiceMicAdapter();
    expect(recorderRefCount()).toBe(1);
    unregisterProsodyMicAdapter();
    expect(recorderRefCount()).toBe(0);
  });

  it('que un módulo se desregistre no deja sin audio al otro', async () => {
    registerVoiceMicAdapter();
    registerProsodyMicAdapter();

    const prosody = getProsodyMicAdapter()!;
    await prosody.startRecording();
    // La pantalla de voz se desmonta a mitad de la toma de prosodia.
    unregisterVoiceMicAdapter();
    for (let b = 0; b < 4; b++) emit();

    const pcm = await prosody.stopRecording();
    expect(pcm.length).toBeGreaterThan(0);
  });
});
