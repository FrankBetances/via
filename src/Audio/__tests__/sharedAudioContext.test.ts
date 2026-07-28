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
// eslint-disable-next-line no-var
var mockCreated: any[] = [];
// eslint-disable-next-line no-var
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
  peekAudioContext,
  releaseAudioContext,
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
