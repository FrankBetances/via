/* -------------------------------------------------------------------------- */
/*  Pruebas del motor de audio COMPARTIDO.                                      */
/*                                                                             */
/*  Regresión del bug «no suena nada»: la app abría un AudioContext por módulo  */
/*  (tonos, palabras de la verbal, consignas de los ejercicios y reproducción   */
/*  del análisis acústico). Cada contexto abre un stream nativo y en Android    */
/*  Oboe los sirve en modo EXCLUSIVO, así que a partir del segundo el audio se  */
/*  quedaba mudo sin lanzar ningún error. Aquí se fija el contrato:             */
/*   · un solo contexto para N consumidores;                                    */
/*   · no se cierra mientras quede alguno;                                      */
/*   · la sesión vuelve sola a reproducción al soltar la última grabación.      */
/* -------------------------------------------------------------------------- */

/* `var` + prefijo `mock`: jest hoista `jest.mock(...)` por encima de las
 * declaraciones, y solo permite que la factoría capture variables así. */
var mockCreated: any[] = [];
var mockSessionOptions: any[] = [];

// Sin `{ virtual: true }`: el paquete existe de verdad, y marcarlo virtual
// hacía que a veces se resolviese el módulo real (que no arranca fuera del
// dispositivo) en lugar de este doble — el test fallaba de forma intermitente.
jest.mock('react-native-audio-api', () => {
  class FakeAudioContext {
    public closed = false;
    public state = 'running';
    public destination = {};
    public options: any;
    constructor(options: any) {
      this.options = options;
      mockCreated.push(this);
    }
    close() {
      this.closed = true;
      return Promise.resolve();
    }
    resume() {
      this.state = 'running';
      return Promise.resolve(true);
    }
  }
  return {
    AudioContext: FakeAudioContext,
    AudioManager: {
      setAudioSessionOptions: (o: any) => mockSessionOptions.push(o),
      setAudioSessionActivity: () => Promise.resolve(true),
    },
  };
});

import {
  acquireAudioContext,
  acquireRecordingSession,
  audioContextRefCount,
  AUDIO_SAMPLE_RATE,
  isRecordingSessionActive,
  onRecordingSessionChange,
  peekAudioContext,
  releaseAudioContext,
  resumeAudioContext,
  __resetSharedAudioContextForTests,
} from '..';

beforeEach(() => {
  mockCreated.length = 0;
  mockSessionOptions.length = 0;
  __resetSharedAudioContextForTests();
});

describe('un único AudioContext para toda la app', () => {
  it('cuatro consumidores comparten UN solo contexto nativo', () => {
    const a = acquireAudioContext();
    const b = acquireAudioContext();
    const c = acquireAudioContext();
    const d = acquireAudioContext();

    expect(mockCreated).toHaveLength(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(c).toBe(d);
    expect(audioContextRefCount()).toBe(4);
  });

  it('se abre a la frecuencia única de la app', () => {
    acquireAudioContext();
    expect(mockCreated[0].options).toEqual({ sampleRate: AUDIO_SAMPLE_RATE });
  });

  it('no se cierra mientras quede algún consumidor', () => {
    acquireAudioContext();
    acquireAudioContext();
    releaseAudioContext();

    expect(mockCreated[0].closed).toBe(false);
    expect(peekAudioContext()).toBe(mockCreated[0]);
  });

  it('se cierra al soltar la última referencia y se reabre después', () => {
    acquireAudioContext();
    releaseAudioContext();
    expect(mockCreated[0].closed).toBe(true);
    expect(peekAudioContext()).toBeNull();

    acquireAudioContext();
    expect(mockCreated).toHaveLength(2);
    expect(mockCreated[1].closed).toBe(false);
  });

  it('soltar de más no rompe ni deja el contador en negativo', () => {
    acquireAudioContext();
    releaseAudioContext();
    releaseAudioContext();
    releaseAudioContext();
    expect(audioContextRefCount()).toBe(0);
  });
});

describe('sesión de audio', () => {
  const categories = () => mockSessionOptions.map(o => o.iosCategory);

  it('arranca en reproducción por altavoz', () => {
    acquireAudioContext();
    expect(categories()).toEqual(['playback']);
  });

  it('la grabación se reserva una sola vez aunque haya varios peticionarios', () => {
    const releaseA = acquireRecordingSession();
    const releaseB = acquireRecordingSession();
    expect(categories()).toEqual(['playAndRecord']);
    expect(isRecordingSessionActive()).toBe(true);

    // Con un peticionario vivo la sesión NO vuelve a reproducción: era la vía
    // por la que el sonómetro dejaba el audio atenuado a media medición.
    releaseA();
    expect(categories()).toEqual(['playAndRecord']);
    expect(isRecordingSessionActive()).toBe(true);

    releaseB();
    expect(categories()).toEqual(['playAndRecord', 'playback']);
    expect(isRecordingSessionActive()).toBe(false);
  });

  it('liberar dos veces el mismo peticionario no descuenta de más', () => {
    const releaseA = acquireRecordingSession();
    const releaseB = acquireRecordingSession();
    releaseA();
    releaseA();
    expect(isRecordingSessionActive()).toBe(true);
    releaseB();
    expect(isRecordingSessionActive()).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Observador de la grabación.                                                */
/*                                                                             */
/*  Este módulo es el único punto por el que pasan todos los consumidores de    */
/*  micrófono, así que es el único desde el que un tercero puede enterarse de   */
/*  que hay una captura en curso sin conocer los módulos clínicos uno a uno. Lo */
/*  usa el permiso de ruido del periférico de refuerzo (src/Lua/noisePermit.ts).*/
/* -------------------------------------------------------------------------- */
describe('observador de sesión de grabación', () => {
  it('avisa de la transición a grabando y de la vuelta a reproducción', () => {
    const visto: boolean[] = [];
    onRecordingSessionChange(active => visto.push(active));

    const release = acquireRecordingSession();
    expect(visto).toEqual([true]);
    release();
    expect(visto).toEqual([true, false]);
  });

  it('avisa de las transiciones 0↔1, no de cada peticionario', () => {
    const visto: boolean[] = [];
    onRecordingSessionChange(active => visto.push(active));

    const releaseA = acquireRecordingSession();
    const releaseB = acquireRecordingSession();
    const releaseC = acquireRecordingSession();
    expect(visto).toEqual([true]);

    releaseA();
    releaseB();
    expect(visto).toEqual([true]);
    releaseC();
    expect(visto).toEqual([true, false]);
  });

  it('el aviso de grabación llega ANTES de reconfigurar la sesión de audio', () => {
    // El orden importa: quien escucha esto lo hace para APAGAR algo que puede
    // hacer ruido, y lo seguro es apagar primero y abrir el micrófono después.
    const orden: string[] = [];
    onRecordingSessionChange(active => orden.push(`aviso:${active}`));
    const antes = mockSessionOptions.length;

    acquireRecordingSession();
    orden.push(`sesión:${mockSessionOptions.length > antes}`);

    expect(orden).toEqual(['aviso:true', 'sesión:true']);
  });

  it('darse de baja deja de recibir avisos', () => {
    const visto: boolean[] = [];
    const off = onRecordingSessionChange(active => visto.push(active));

    acquireRecordingSession()();
    off();
    acquireRecordingSession()();

    expect(visto).toEqual([true, false]);
  });

  it('un oyente que lanza no impide reservar la sesión de grabación', () => {
    // El micrófono clínico manda sobre cualquier accesorio colgado del aviso.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    onRecordingSessionChange(() => {
      throw new Error('el accesorio falló');
    });
    const otro: boolean[] = [];
    onRecordingSessionChange(active => otro.push(active));

    expect(() => acquireRecordingSession()).not.toThrow();
    expect(isRecordingSessionActive()).toBe(true);
    expect(mockSessionOptions.map(o => o.iosCategory)).toContain('playAndRecord');
    // Y el oyente siguiente sigue recibiendo el aviso.
    expect(otro).toEqual([true]);
    warn.mockRestore();
  });
});

describe('reactivación del contexto (resumeAudioContext)', () => {
  it('llama a ctx.resume() de forma incondicional aunque ctx.state sea "running"', () => {
    const ctx = acquireAudioContext() as any;
    expect(ctx.state).toBe('running');
    const resumeSpy = jest.spyOn(ctx, 'resume');

    resumeAudioContext();
    expect(resumeSpy).toHaveBeenCalledTimes(1);
  });

  it('reasegura la sesión en modo playback si no hay grabación activa', () => {
    acquireAudioContext();
    mockSessionOptions.length = 0;

    resumeAudioContext();
    expect(mockSessionOptions.map(o => o.iosCategory)).toContain('playback');
  });

  it('no sobreescribe la sesión si hay una grabación activa', () => {
    acquireAudioContext();
    acquireRecordingSession();
    mockSessionOptions.length = 0;

    resumeAudioContext();
    // No debe haber enviado 'playback'
    expect(mockSessionOptions.map(o => o.iosCategory)).not.toContain('playback');
  });

  it('no falla si el contexto es nulo o resume lanza', () => {
    expect(() => resumeAudioContext()).not.toThrow();

    const ctx = acquireAudioContext() as any;
    ctx.resume = () => {
      throw new Error('resume failed');
    };
    expect(() => resumeAudioContext()).not.toThrow();
  });
});

