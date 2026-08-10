/* -------------------------------------------------------------------------- */
/*  Pruebas del permiso de ruido — el control de riesgo L-1.                    */
/*                                                                             */
/*  Esta suite es el expediente de verificación del control, no una prueba de    */
/*  unidad más: cada `it` corresponde a un modo de fallo de la tabla de §8. Lo   */
/*  que se demuestra aquí es que TODO camino termina en silencio, y en particular */
/*  los caminos en los que el software deja de funcionar — que son los que un     */
/*  «comando de silencio» no podría cubrir.                                      */
/*                                                                             */
/*  Se prueba `createNoisePermitController` con dependencias inyectadas: sin BLE, */
/*  sin audio nativo y con temporizadores falsos, para poder ejecutarlo en cada   */
/*  commit. Ver docs/design/integracion-lua.md §3.                              */
/* -------------------------------------------------------------------------- */

import {
  createNoisePermitController,
  isNoiseAllowedRoute,
  NOISE_ALLOWED_ROUTES,
  type NoisePermitController,
} from '../noisePermit';
import { LUA_NOISE_PERMIT_RENEWAL_MS, LUA_NOISE_PERMIT_TTL_MS } from '../luaProtocol';

/** Doble del enlace: registra cada trama enviada al periférico. */
interface Sent {
  ttlMs: number;
  sequence: number;
}

function setup(options: { canMakeNoise?: boolean; recording?: boolean } = {}) {
  const sent: Sent[] = [];
  let recordingListener: ((active: boolean) => void) | null = null;
  let recording = options.recording ?? false;
  let unsubscribed = false;

  const controller = createNoisePermitController({
    sendPermit: (ttlMs, sequence) => sent.push({ ttlMs, sequence }),
    canMakeNoise: () => options.canMakeNoise ?? true,
    isRecordingActive: () => recording,
    subscribeRecording: listener => {
      recordingListener = listener;
      return () => {
        unsubscribed = true;
      };
    },
  });

  return {
    controller,
    sent,
    /** Simula la transición 0↔1 de `acquireRecordingSession()`. */
    setRecording: (active: boolean) => {
      recording = active;
      recordingListener?.(active);
    },
    wasUnsubscribed: () => unsubscribed,
    /** Últimos TTL enviados, que es lo que decide si hay ruido o no. */
    ttls: () => sent.map(s => s.ttlMs),
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('arranque', () => {
  it('sin ruta conocida no hay permiso ni se envía nada', () => {
    const { controller, sent } = setup();
    expect(controller.isGranted()).toBe(false);
    expect(sent).toEqual([]);
  });

  it('una ruta desconocida (pantalla nueva) no concede permiso', () => {
    // La lista blanca es por INCLUSIÓN: lo que se escriba en 2027 nace mudo.
    const { controller, sent } = setup();
    controller.setRoute('ModuloQueNadieHaEscritoTodavia');
    expect(controller.isGranted()).toBe(false);
    expect(sent).toEqual([]);
  });

  it('instalarse a mitad de una grabación no concede permiso', () => {
    const { controller, sent } = setup({ recording: true });
    controller.setRoute('SeleccionEjercicios');
    expect(controller.isGranted()).toBe(false);
    expect(sent).toEqual([]);
  });
});

describe('capa 1 · lista blanca de pantallas', () => {
  it('las cuatro rutas permitidas son las de §3 y ninguna tiene clínica', () => {
    expect(NOISE_ALLOWED_ROUTES).toEqual([
      'Bienvenida',
      'SeleccionEjercicios',
      'ResultadosPreliminares',
      'ResultadosFinal',
    ]);
  });

  it.each([
    'VoiceAnalysis',
    'ProsodyAnalysis',
    'VerbalAudiometry',
    'Audiometry',
    'AudiometryConditioned',
    'Articulation',
    'RoomNoiseCheck',
    'DysphagiaTest',
    'SahsScreening',
    'ExecutiveFunctions',
    'ClinicalAssessment',
    'Mchat',
  ])('el módulo %s no está en la lista blanca', route => {
    expect(isNoiseAllowedRoute(route)).toBe(false);
  });

  it('concede al entrar en una pantalla permitida', () => {
    const { controller, sent } = setup();
    controller.setRoute('SeleccionEjercicios');
    expect(controller.isGranted()).toBe(true);
    expect(sent).toEqual([{ ttlMs: LUA_NOISE_PERMIT_TTL_MS, sequence: 1 }]);
  });

  it('revoca al entrar en un módulo clínico, y lo dice explícitamente', () => {
    const { controller, ttls } = setup();
    controller.setRoute('SeleccionEjercicios');
    controller.setRoute('VoiceAnalysis');
    expect(controller.isGranted()).toBe(false);
    expect(ttls()).toEqual([LUA_NOISE_PERMIT_TTL_MS, 0]);
  });

  it('moverse entre dos pantallas permitidas no reconcede ni parpadea', () => {
    const { controller, ttls } = setup();
    controller.setRoute('ResultadosPreliminares');
    controller.setRoute('ResultadosFinal');
    expect(ttls()).toEqual([LUA_NOISE_PERMIT_TTL_MS]);
    expect(controller.isGranted()).toBe(true);
  });

  it('dentro de un módulo NO se renueva, ni una sola vez', () => {
    const { controller, sent } = setup();
    controller.setRoute('VoiceAnalysis');
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_RENEWAL_MS * 20);
    expect(sent).toEqual([]);
  });
});

describe('capa 2 · revocación por sesión de grabación', () => {
  it('abrir el micrófono revoca en el acto, sin esperar al siguiente tick', () => {
    const { controller, setRecording, ttls } = setup();
    controller.setRoute('SeleccionEjercicios');
    setRecording(true);
    expect(controller.isGranted()).toBe(false);
    expect(ttls()).toEqual([LUA_NOISE_PERMIT_TTL_MS, 0]);
  });

  it('cubre a un módulo que abre el micrófono en una pantalla permitida', () => {
    // El caso del «quinto módulo»: alguien graba desde una pantalla que la lista
    // blanca permite. La capa 1 no lo ve; la capa 2 sí.
    const { controller, setRecording, sent } = setup();
    controller.setRoute('ResultadosFinal');
    setRecording(true);
    const enviadasHasta = sent.length;
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_RENEWAL_MS * 10);
    expect(sent).toHaveLength(enviadasHasta);
    expect(controller.isGranted()).toBe(false);
  });

  it('al cerrar el micrófono en una pantalla permitida se vuelve a conceder', () => {
    const { controller, setRecording, ttls } = setup();
    controller.setRoute('SeleccionEjercicios');
    setRecording(true);
    setRecording(false);
    expect(controller.isGranted()).toBe(true);
    expect(ttls()).toEqual([LUA_NOISE_PERMIT_TTL_MS, 0, LUA_NOISE_PERMIT_TTL_MS]);
  });

  it('al cerrar el micrófono dentro de un módulo NO se concede nada', () => {
    const { controller, setRecording, sent } = setup();
    controller.setRoute('Articulation');
    setRecording(true);
    setRecording(false);
    expect(controller.isGranted()).toBe(false);
    expect(sent).toEqual([]);
  });
});

describe('capa 3 · caducidad', () => {
  it('renueva con la cadencia acordada mientras el permiso siga vigente', () => {
    const { controller, sent } = setup();
    controller.setRoute('SeleccionEjercicios');
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_RENEWAL_MS * 3);
    expect(sent).toHaveLength(4); // la concesión + tres renovaciones
    expect(sent.every(s => s.ttlMs === LUA_NOISE_PERMIT_TTL_MS)).toBe(true);
  });

  it('cada renovación lleva una secuencia distinta', () => {
    const { controller, sent } = setup();
    controller.setRoute('SeleccionEjercicios');
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_RENEWAL_MS * 3);
    expect(sent.map(s => s.sequence)).toEqual([1, 2, 3, 4]);
  });

  it('la app que se muere deja de renovar: el firmware caduca solo', () => {
    // No hay nada que enviar al morir —justo el punto del diseño—, así que lo
    // que se verifica es que el último permiso concedido tiene fecha de
    // caducidad y que nadie la renueva más.
    const { controller, sent } = setup();
    controller.setRoute('SeleccionEjercicios');
    controller.stop(); // equivalente a que la app deje de existir
    const trasParar = sent.length;
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_TTL_MS * 10);
    expect(sent).toHaveLength(trasParar);
    expect(sent.every(s => s.ttlMs <= LUA_NOISE_PERMIT_TTL_MS)).toBe(true);
  });

  it('nunca se concede un permiso sin caducidad', () => {
    const { controller, sent } = setup();
    controller.setRoute('SeleccionEjercicios');
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_RENEWAL_MS * 50);
    expect(sent.every(s => s.ttlMs > 0 && s.ttlMs <= LUA_NOISE_PERMIT_TTL_MS)).toBe(true);
  });

  it('la renovación revalida: si el estado cambió sin avisar, el permiso muere ahí', () => {
    // Defensa contra un observador que se pierda una transición. El primer tick
    // que encuentre el estado inconsistente revoca.
    let canMakeNoise = true;
    const sent: Sent[] = [];
    const controller: NoisePermitController = createNoisePermitController({
      sendPermit: (ttlMs, sequence) => sent.push({ ttlMs, sequence }),
      canMakeNoise: () => canMakeNoise,
      isRecordingActive: () => false,
      subscribeRecording: () => () => {},
    });
    controller.setRoute('SeleccionEjercicios');
    canMakeNoise = false; // el periférico se fue sin que nadie lo notificara
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_RENEWAL_MS);
    expect(controller.isGranted()).toBe(false);
    expect(sent.map(s => s.ttlMs)).toEqual([LUA_NOISE_PERMIT_TTL_MS, 0]);
  });
});

describe('capa 4 · el hardware que no puede hacer ruido', () => {
  it('a Lúa v1 (sin altavoz ni motores) no se le envía ni un permiso', () => {
    const { controller, sent } = setup({ canMakeNoise: false });
    controller.setRoute('SeleccionEjercicios');
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_RENEWAL_MS * 10);
    expect(controller.isGranted()).toBe(false);
    expect(sent).toEqual([]);
  });
});

describe('parada', () => {
  it('revoca, deja de renovar y se da de baja del observador', () => {
    const { controller, ttls, wasUnsubscribed } = setup();
    controller.setRoute('SeleccionEjercicios');
    controller.stop();
    expect(ttls()).toEqual([LUA_NOISE_PERMIT_TTL_MS, 0]);
    expect(wasUnsubscribed()).toBe(true);
    expect(controller.isGranted()).toBe(false);
  });

  it('tras parar, ninguna ruta permitida vuelve a conceder', () => {
    const { controller, sent } = setup();
    controller.stop();
    controller.setRoute('SeleccionEjercicios');
    jest.advanceTimersByTime(LUA_NOISE_PERMIT_RENEWAL_MS * 10);
    expect(sent).toEqual([]);
    expect(controller.isGranted()).toBe(false);
  });
});
