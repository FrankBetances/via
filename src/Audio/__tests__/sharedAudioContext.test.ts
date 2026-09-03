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
    /* El motor real NO se levanta con `resume()` cuando el stream nunca abrió:
     * `AudioContext::resume()` acaba en `mStream_->requestStart()` con
     * `mStream_` nulo. Este doble lo reproduce con `deadStream`: el contexto
     * existe, responde «suspended» y `resume()` no lo cambia. */
    markDeadStream() {
      this.state = 'suspended';
      this.resume = () => Promise.resolve(false);
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
  isOutputDriverRunning,
  onAudioContextChange,
  peekAudioContext,
  recoverAudioContext,
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
  /* Lo que `ctx.state` significa de verdad en react-native-audio-api 0.8.4,
   * leído en `node_modules` y no supuesto: el puente no expone `state_`, sino
   * `BaseAudioContext::getState()` (BaseAudioContext.cpp:31), que devuelve
   * «suspended» siempre que `isDriverRunning()` sea falso —es decir, siempre
   * que el stream de Oboe no esté `Started` (AudioPlayer.cpp:79)—. Así que
   * «running» YA implica driver vivo, y reactivar es lo que toca justo cuando
   * el motor dice lo contrario. */
  it('reactiva cuando el motor declara que el driver no está corriendo', () => {
    const ctx = acquireAudioContext() as any;
    const resumeSpy = jest.spyOn(ctx, 'resume');

    ctx.state = 'suspended';
    resumeAudioContext();

    expect(resumeSpy).toHaveBeenCalledTimes(1);
  });

  it('no llama a resume() cuando el driver ya corre', () => {
    const ctx = acquireAudioContext() as any;
    expect(ctx.state).toBe('running');
    const resumeSpy = jest.spyOn(ctx, 'resume');

    resumeAudioContext();

    // `AudioContext::resume()` (AudioContext.cpp:59) abre con
    // `if (isRunning()) return true;`: llamarlo aquí es un no-op con un salto
    // por el puente JSI en CADA estímulo de la audiometría.
    expect(resumeSpy).not.toHaveBeenCalled();
  });

  it('no reconfigura la sesión de audio al reactivar', () => {
    const ctx = acquireAudioContext() as any;
    mockSessionOptions.length = 0;
    ctx.state = 'suspended';

    resumeAudioContext();

    // La sesión se aplica al crear el contexto y al soltar la última captura.
    // Reaplicarla por estímulo no arregla nada: en Android
    // `AudioAPIModule.kt:66` la implementa como «noting to do here».
    expect(mockSessionOptions).toHaveLength(0);
  });

  it('no falla si el contexto es nulo o resume lanza', () => {
    expect(() => resumeAudioContext()).not.toThrow();

    const ctx = acquireAudioContext() as any;
    ctx.state = 'suspended';
    ctx.resume = () => {
      throw new Error('resume failed');
    };
    expect(() => resumeAudioContext()).not.toThrow();
  });
});


describe('recuperación de un contexto muerto (recoverAudioContext)', () => {
  /* El fallo que esto cubre: `openAudioStream()` falla, `mStream_` queda nulo y
   * el constructor de `AudioContext` pone `state_ = RUNNING` ignorando el
   * `false` de `start()`. El objeto existe, no lanza y NO SUENA NADA. Como el
   * contexto se abre al arrancar la app y no se suelta jamás, la sesión entera
   * se queda muda sin reintento y sin mensaje. */

  it('sustituye el contexto cuyo stream nativo no arrancó', () => {
    const dead = acquireAudioContext() as any;
    dead.markDeadStream();

    const revived = recoverAudioContext() as any;

    expect(revived).not.toBeNull();
    expect(revived).not.toBe(dead);
    expect(dead.closed).toBe(true);
    expect(mockCreated).toHaveLength(2);
    expect(peekAudioContext()).toBe(revived);
  });

  it('conserva el recuento de reservas: nadie se queda sin contexto', () => {
    acquireAudioContext();
    acquireAudioContext();
    (peekAudioContext() as any).markDeadStream();

    recoverAudioContext();

    expect(audioContextRefCount()).toBe(2);
    // Y soltar las dos reservas sigue cerrando el contexto NUEVO.
    releaseAudioContext();
    releaseAudioContext();
    expect(peekAudioContext()).toBeNull();
  });

  it('no toca nada si el driver ya está corriendo', () => {
    const live = acquireAudioContext();

    expect(recoverAudioContext()).toBe(live);
    expect(mockCreated).toHaveLength(1);
  });

  it('avisa a los adaptadores para que suelten la referencia muerta', () => {
    const visto: Array<unknown> = [];
    const baja = onAudioContextChange(next => visto.push(next));

    const dead = acquireAudioContext() as any;
    dead.markDeadStream();
    const revived = recoverAudioContext();

    expect(visto).toEqual([revived]);
    baja();

    (peekAudioContext() as any).markDeadStream();
    recoverAudioContext();
    expect(visto).toHaveLength(1);
  });

  it('un oyente que lanza no impide la recuperación', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    onAudioContextChange(() => {
      throw new Error('oyente roto');
    });
    let visto: unknown = 'sin avisar';
    onAudioContextChange(next => {
      visto = next;
    });

    (acquireAudioContext() as any).markDeadStream();
    const revived = recoverAudioContext();

    expect(revived).not.toBeNull();
    expect(visto).toBe(revived);
    warn.mockRestore();
  });

  it('isOutputDriverRunning distingue el contexto vivo del muerto', () => {
    expect(isOutputDriverRunning()).toBe(false); // sin contexto

    const ctx = acquireAudioContext() as any;
    expect(isOutputDriverRunning()).toBe(true);

    ctx.markDeadStream();
    expect(isOutputDriverRunning()).toBe(false);
  });
});
