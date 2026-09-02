/* -------------------------------------------------------------------------- */
/*  Batería de Pruebas Adversariales y de Estrés de Audio (Challenger 1).     */
/*                                                                             */
/*  Somete a estrés los cuatro subsistemas de audio de VIA+:                   */
/*   1. SharedAudioContext (concurrencia, fugas de refcount, caída de Oboe)    */
/*   2. viaVoicePlayback (ráfagas de locuciones, codecs rotos, timeouts)       */
/*   3. audiometryToneAdapter (tormenta de tonos, parámetros extremos, nodos)  */
/*   4. audioSelfTest (detección de congelación de reloj, bloqueos de sesión)  */
/*   5. Concurrencia cruzada y resistencia a interbloqueos (deadlocks)         */
/* -------------------------------------------------------------------------- */

var mockNodes = {
  oscillators: [] as any[],
  gains: [] as any[],
  panners: [] as any[],
};

var mockSessionHistory: any[] = [];
var mockContextState = 'running';
var mockContextCurrentTime = 0;
var mockAudioContextFailToCreate = false;
var mockAudioContextThrowOnResume = false;

var mockExpoAudio = {
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(async (_opts?: any) => {}),
};

jest.mock('react-native-audio-api', () => {
  class FakeParam {
    value = 0;
    setValueAtTime = jest.fn((val: number) => {
      this.value = val;
    });
    linearRampToValueAtTime = jest.fn((val: number) => {
      this.value = val;
    });
  }

  class FakeOscillator {
    type = 'sine';
    frequency = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
    start = jest.fn();
    stop = jest.fn();
    constructor() {
      mockNodes.oscillators.push(this);
    }
  }

  class FakeGain {
    gain = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
    constructor() {
      mockNodes.gains.push(this);
    }
  }

  class FakePanner {
    pan = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
    constructor() {
      mockNodes.panners.push(this);
    }
  }

  class FakeAudioContext {
    public sampleRate = 48000;
    public destination = {};
    public closed = false;

    get state() {
      return mockContextState;
    }
    set state(val: string) {
      mockContextState = val;
    }

    get currentTime() {
      return mockContextCurrentTime;
    }
    set currentTime(val: number) {
      mockContextCurrentTime = val;
    }

    constructor(_options?: any) {
      if (mockAudioContextFailToCreate) {
        throw new Error('Native Oboe stream open failed (EIO/EBUSY)');
      }
    }

    createOscillator = () => new FakeOscillator();
    createGain = () => new FakeGain();
    createStereoPanner = () => new FakePanner();

    resume = jest.fn(async () => {
      if (mockAudioContextThrowOnResume) {
        throw new Error('Native resume failed: Audio track stopped');
      }
      mockContextState = 'running';
      return true;
    });

    close = jest.fn(async () => {
      this.closed = true;
    });
  }

  class FakeAudioRecorder {
    prepare = jest.fn(async () => true);
    record = jest.fn();
    stop = jest.fn(async () => {});
    release = jest.fn(async () => {});
  }

  return {
    AudioContext: FakeAudioContext,
    AudioRecorder: FakeAudioRecorder,
    AudioManager: {
      setAudioSessionOptions: (o: any) => mockSessionHistory.push(o),
      setAudioSessionActivity: jest.fn(async () => true),
    },
  };
});

jest.mock('expo-audio', () => ({
  createAudioPlayer: (asset: any) => mockExpoAudio.createAudioPlayer(asset),
  setAudioModeAsync: (opts?: any) => mockExpoAudio.setAudioModeAsync(opts),
}));

import {
  acquireAudioContext,
  acquireRecordingSession,
  audioContextRefCount,
  isAudioEngineAvailable,
  isRecordingSessionActive,
  peekAudioContext,
  releaseAudioContext,
  resumeAudioContext,
  __resetSharedAudioContextForTests,
} from '@/Audio';

import {
  playVoiceAsset,
  stopVoiceAsset,
  probeVoiceAsset,
  disposeVoicePlayback,
  __resetVoicePlaybackForTests,
} from '@/Voice/viaVoicePlayback';

import { installAudiometryToneAdapter } from '@/Screens/Audiometry/audiometryToneAdapter';
import * as useAudiometryModule from '@/Screens/Audiometry/useAudiometryTest';

import {
  checkNativeEngine,
  checkOutputContext,
  probeOutputClock,
} from '@/Screens/DiagnosticoAudio/audioSelfTest';

describe('Adversarial Audio Subsystems Stress & Edge-Case Suite', () => {
  let capturedAdapter: useAudiometryModule.AudiometryToneAdapter | null = null;
  let setAdapterSpy: jest.SpyInstance | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNodes.oscillators = [];
    mockNodes.gains = [];
    mockNodes.panners = [];
    mockSessionHistory.length = 0;
    mockContextState = 'running';
    mockContextCurrentTime = 0;
    mockAudioContextFailToCreate = false;
    mockAudioContextThrowOnResume = false;

    capturedAdapter = null;
    setAdapterSpy = jest.spyOn(useAudiometryModule, 'setAudiometryToneAdapter')
      .mockImplementation((a: any) => {
        capturedAdapter = a;
      });

    __resetSharedAudioContextForTests();
    __resetVoicePlaybackForTests();
  });

  afterEach(() => {
    setAdapterSpy?.mockRestore();
    disposeVoicePlayback();
    __resetVoicePlaybackForTests();
    __resetSharedAudioContextForTests();
  });

  /* ======================================================================== */
  /*  1. SharedAudioContext Stress & Invariant Validation                     */
  /* ======================================================================== */
  describe('1. SharedAudioContext Stress & Boundary Tests', () => {
    it('soporta 1000 reservas y liberaciones intercaladas y mantiene refcount exacto', () => {
      expect(audioContextRefCount()).toBe(0);
      expect(peekAudioContext()).toBeNull();

      for (let i = 0; i < 500; i++) {
        acquireAudioContext();
      }
      expect(audioContextRefCount()).toBe(500);
      expect(peekAudioContext()).not.toBeNull();

      for (let i = 0; i < 250; i++) {
        releaseAudioContext();
      }
      expect(audioContextRefCount()).toBe(250);
      expect(peekAudioContext()).not.toBeNull();

      for (let i = 0; i < 250; i++) {
        releaseAudioContext();
      }
      expect(audioContextRefCount()).toBe(0);
      expect(peekAudioContext()).toBeNull();

      // Liberación en exceso no produce números negativos ni corrompe el estado
      for (let i = 0; i < 100; i++) {
        releaseAudioContext();
      }
      expect(audioContextRefCount()).toBe(0);
      expect(peekAudioContext()).toBeNull();
    });

    it('reactiva el stream Oboe incluso ante la mentira de state = "running"', () => {
      const ctx = acquireAudioContext() as any;
      expect(ctx).not.toBeNull();
      expect(ctx.state).toBe('running');

      const resumeSpy = jest.spyOn(ctx, 'resume');
      resumeAudioContext();

      expect(resumeSpy).toHaveBeenCalledTimes(1);
    });

    it('sobrevive a excepciones dentro de ctx.resume() sin tumbar la ejecución', () => {
      const ctx = acquireAudioContext() as any;
      ctx.resume = () => {
        throw new Error('Native resume thrown');
      };

      expect(() => resumeAudioContext()).not.toThrow();
    });

    it('gestiona sesiones de grabación concurrentes y restaura playback al liberar la última', () => {
      acquireAudioContext();
      expect(mockSessionHistory.map(s => s.iosCategory)).toContain('playback');
      mockSessionHistory.length = 0;

      const rel1 = acquireRecordingSession();
      const rel2 = acquireRecordingSession();
      const rel3 = acquireRecordingSession();

      expect(isRecordingSessionActive()).toBe(true);
      expect(mockSessionHistory.map(s => s.iosCategory)).toContain('playAndRecord');

      // Durante la grabación activa, resumeAudioContext NO debe pisar con playback
      mockSessionHistory.length = 0;
      resumeAudioContext();
      expect(mockSessionHistory.map(s => s.iosCategory)).not.toContain('playback');

      // Liberación parcial mantiene modo grabación
      rel1();
      rel2();
      expect(isRecordingSessionActive()).toBe(true);

      // Liberar dos veces el mismo manejador rel1 no resta doble
      rel1();
      expect(isRecordingSessionActive()).toBe(true);

      // Al soltar el último, se restaura playback
      mockSessionHistory.length = 0;
      rel3();
      expect(isRecordingSessionActive()).toBe(false);
      expect(mockSessionHistory.map(s => s.iosCategory)).toContain('playback');
    });

    it('marca engine no disponible si el constructor de AudioContext falla', () => {
      mockAudioContextFailToCreate = true;
      const ctx = acquireAudioContext();

      expect(ctx).toBeNull();
      expect(isAudioEngineAvailable()).toBe(false);

      // Siguientes llamadas son NO-OP seguras
      expect(acquireAudioContext()).toBeNull();
      expect(() => resumeAudioContext()).not.toThrow();
    });
  });

  /* ======================================================================== */
  /*  2. viaVoicePlayback Adversarial & Concurrency Stress                    */
  /* ======================================================================== */
  describe('2. viaVoicePlayback Adversarial & Edge-Case Tests', () => {
    it('soporta ráfaga rápida de 50 llamadas consecutivas a playVoiceAsset sin fugas', async () => {
      const createdPlayers: any[] = [];

      mockExpoAudio.createAudioPlayer.mockImplementation((asset: any) => {
        const p = {
          asset,
          playing: false,
          play: jest.fn(() => {
            p.playing = true;
          }),
          pause: jest.fn(() => {
            p.playing = false;
          }),
          remove: jest.fn(),
          addListener: jest.fn(() => ({ remove: jest.fn() })),
        };
        createdPlayers.push(p);
        return p;
      });

      // Ráfaga de 50 llamadas en paralelo/secuencia rápida
      const promises = [];
      for (let i = 1; i <= 50; i++) {
        promises.push(playVoiceAsset(i * 100));
      }
      const results = await Promise.all(promises);

      expect(results.every(r => r === true)).toBe(true);
      expect(createdPlayers.length).toBe(50);

      // Los primeros 49 reproductores deben haber sido pausados y removidos
      for (let i = 0; i < 49; i++) {
        expect(createdPlayers[i].pause).toHaveBeenCalled();
        expect(createdPlayers[i].remove).toHaveBeenCalled();
      }

      // Solo el último reproductor (50) está activo
      const lastPlayer = createdPlayers[49];
      expect(lastPlayer.play).toHaveBeenCalled();
      expect(lastPlayer.remove).not.toHaveBeenCalled();
    });

    it('maneja entradas nulas/indefinidas sin lanzar excepciones', async () => {
      expect(await playVoiceAsset(null as any)).toBe(false);
      expect(await playVoiceAsset(undefined as any)).toBe(false);
      expect(mockExpoAudio.createAudioPlayer).not.toHaveBeenCalled();
    });

    it('se recupera con gracia si setAudioModeAsync rechaza la promesa', async () => {
      mockExpoAudio.setAudioModeAsync.mockRejectedValueOnce(new Error('Audio focus rejected'));

      const fakePlayer = {
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      };
      mockExpoAudio.createAudioPlayer.mockReturnValue(fakePlayer);

      const success = await playVoiceAsset(999);
      expect(success).toBe(true);
      expect(fakePlayer.play).toHaveBeenCalled();
    });

    it('probeVoiceAsset resiste timeouts y condiciones de error en carga', async () => {
      // 1. Timeout por carga nunca completada
      const stuckLoadingPlayer = {
        isLoaded: false,
        duration: 0,
        currentTime: 0,
        playing: false,
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      };
      mockExpoAudio.createAudioPlayer.mockReturnValueOnce(stuckLoadingPlayer);

      const probe1 = await probeVoiceAsset(111, 50, 20);
      expect(probe1.loaded).toBe(false);
      expect(probe1.advanced).toBe(false);
      expect(probe1.detail).toMatch(/no llegó a cargar/);

      // 2. Cargado pero reloj estancado (currentTime = 0)
      const stuckClockPlayer = {
        isLoaded: true,
        duration: 2.5,
        currentTime: 0,
        playing: false,
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      };
      mockExpoAudio.createAudioPlayer.mockReturnValueOnce(stuckClockPlayer);

      const probe2 = await probeVoiceAsset(222, 100, 20);
      expect(probe2.loaded).toBe(true);
      expect(probe2.advanced).toBe(false);
      expect(probe2.detail).toMatch(/la reproducción NO avanzó tras «play»/);
      
      // La limpieza explícita de disposeVoicePlayback desaloja el reproductor
      disposeVoicePlayback();
      expect(stuckClockPlayer.remove).toHaveBeenCalled();
    });
  });

  /* ======================================================================== */
  /*  3. audiometryToneAdapter Stress & Extreme Inputs                         */
  /* ======================================================================== */
  describe('3. audiometryToneAdapter Adversarial & Boundary Tests', () => {
    it('soporta ráfaga rápida de 100 llamadas a playTone alternando timbres y canales', () => {
      const uninstall = installAudiometryToneAdapter();
      expect(capturedAdapter).not.toBeNull();

      const targets = [500, 1000, 2000, 4000, 125, 8000, 'amb', 'tren'] as const;
      const channels = ['OD', 'OI', 'CL'] as const;

      // Disparar 100 emisiones seguidas
      for (let i = 0; i < 100; i++) {
        const target = targets[i % targets.length];
        const channel = channels[i % channels.length];
        capturedAdapter!.playTone(target, 40, channel);
      }

      // Verificamos que no se produce desbordamiento y que los nodos se crearon
      expect(mockNodes.oscillators.length).toBeGreaterThan(0);

      // Llamar stop() detiene todo limpiamente
      capturedAdapter!.stop();
      for (const osc of mockNodes.oscillators) {
        expect(osc.stop).toHaveBeenCalled();
        expect(osc.disconnect).toHaveBeenCalled();
      }

      uninstall();
      expect(capturedAdapter).toBeNull();
    });

    it('maneja valores extremos de frecuencia, dB HL y canales atípicos sin romper', () => {
      const uninstall = installAudiometryToneAdapter();
      expect(capturedAdapter).not.toBeNull();

      // Frecuencias extremas
      expect(() => capturedAdapter!.playTone(-500 as any, 50, 'OD')).not.toThrow();
      expect(() => capturedAdapter!.playTone(0, 50, 'OI')).not.toThrow();
      expect(() => capturedAdapter!.playTone(24000, 50, 'CL')).not.toThrow();

      // Niveles extremos
      expect(() => capturedAdapter!.playTone(1000, -100, 'OD')).not.toThrow();
      expect(() => capturedAdapter!.playTone(1000, 150, 'OI')).not.toThrow();

      // Canales no estándar
      expect(() => capturedAdapter!.playTone(1000, 40, 'UNKNOWN_CHANNEL' as any)).not.toThrow();

      // Target de sonido desconocido
      expect(() => capturedAdapter!.playTone('unknown_target' as any, 40, 'CL')).not.toThrow();

      uninstall();
    });

    it('permite llamadas repetidas a stop() sin efectos colaterales', () => {
      const uninstall = installAudiometryToneAdapter();
      expect(capturedAdapter).not.toBeNull();

      for (let i = 0; i < 10; i++) {
        expect(() => capturedAdapter!.stop()).not.toThrow();
      }

      uninstall();
    });
  });

  /* ======================================================================== */
  /*  4. audioSelfTest Diagnostic Probing & Lock Warnings                     */
  /* ======================================================================== */
  describe('4. audioSelfTest Diagnostic Probing', () => {
    it('detecta reloj estancado (currentTime = 0 continuo) mediante probeOutputClock', async () => {
      // Dejamos mockContextCurrentTime fijo en 0
      mockContextCurrentTime = 0;

      const probe = await probeOutputClock(20);
      expect(probe.advancing).toBe(false);
      expect(probe.deltaTime).toBe(0);
      expect(probe.initialTime).toBe(0);
      expect(probe.finalTime).toBe(0);
    });

    it('detecta avance de reloj cuando currentTime se incrementa en el hardware', async () => {
      mockContextCurrentTime = 1.0;

      // Simulamos que el hardware avanza durante la ventana de sondeo
      const probePromise = probeOutputClock(30);

      // Simulamos tick de reloj de audio
      setTimeout(() => {
        mockContextCurrentTime = 1.05;
      }, 10);

      const probe = await probePromise;
      expect(probe.advancing).toBe(true);
      expect(probe.deltaTime).toBeCloseTo(0.05, 3);
      expect(probe.initialTime).toBe(1.0);
      expect(probe.finalTime).toBe(1.05);
    });

    it('checkOutputContext emite advertencia explícita si la sesión de grabación está retenida', () => {
      const releaseRec = acquireRecordingSession();

      const res = checkOutputContext();
      expect(res.status).toBe('warn');
      expect(res.detail).toMatch(/playAndRecord/);
      expect(res.hint).toMatch(/micrófono abierto/);

      releaseRec();

      const resAfter = checkOutputContext();
      expect(resAfter.status).toBe('ok');
      expect(resAfter.detail).toMatch(/currentTime/);
    });

    it('checkOutputContext reporta fallo si el motor de salida se marcó como no disponible', () => {
      mockAudioContextFailToCreate = true;
      acquireAudioContext(); // Forzar marca de unavailable

      const res = checkOutputContext();
      expect(res.status).toBe('fail');
      expect(res.detail).toMatch(/no disponible en este arranque/);
    });

    it('checkNativeEngine valida presencia de todas las piezas nativas requeridas', () => {
      const res = checkNativeEngine();
      expect(res.status).toBe('ok');
      expect(res.detail).toMatch(/AudioContext, AudioRecorder y AudioManager presentes/);
    });
  });

  /* ======================================================================== */
  /*  5. Cross-Subsystem Interactions & Deadlock Freedom                      */
  /* ======================================================================== */
  describe('5. Cross-Subsystem Concurrency & Teardown Scrambling', () => {
    it('ejecuta simultáneamente tono, voz, grabación y diagnóstico sin interbloqueos', async () => {
      // 1. Instalar adaptador de tono
      const uninstallTone = installAudiometryToneAdapter();
      expect(capturedAdapter).not.toBeNull();

      // 2. Iniciar tono
      capturedAdapter!.playTone(1000, 45, 'OD');

      // 3. Adquirir sesión de micrófono
      const releaseRecording = acquireRecordingSession();
      expect(isRecordingSessionActive()).toBe(true);

      // 4. Iniciar locución de voz en paralelo
      const fakeVoicePlayer = {
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      };
      mockExpoAudio.createAudioPlayer.mockReturnValue(fakeVoicePlayer);
      const voiceStarted = await playVoiceAsset(777);
      expect(voiceStarted).toBe(true);

      // 5. Ejecutar diagnóstico de reloj y salida durante la actividad cruzada
      mockContextCurrentTime = 5.0;
      setTimeout(() => {
        mockContextCurrentTime = 5.04;
      }, 10);
      const clockProbe = await probeOutputClock(20);
      expect(clockProbe.advancing).toBe(true);

      // 6. Desmontar recursos en orden inverso sin errores
      stopVoiceAsset();
      releaseRecording();
      capturedAdapter!.stop();
      uninstallTone();

      expect(isRecordingSessionActive()).toBe(false);
      expect(audioContextRefCount()).toBe(0);
    });
  });
});
