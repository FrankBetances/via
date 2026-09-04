/* -------------------------------------------------------------------------- */
/*  LAS DOS CADENAS DE SALIDA QUE EL DIAGNÓSTICO NO MIRABA.                    */
/*                                                                             */
/*  Informe de campo (25/8/2026): «la audiometría verbal y el test de          */
/*  articulación siguen sin sonido; adjunto captura que dice que todo          */
/*  funciona, pero es información falsa».                                      */
/*                                                                             */
/*  Y la captura no mentía sobre lo que había medido: medía el banco de        */
/*  locuciones (expo-audio) y el número de voces que el sistema enumera. La    */
/*  audiometría verbal no suena por ahí —decodifica un recorte en base64 sobre */
/*  el AudioContext y lo reproduce por BufferSource— y el modelo hablado del   */
/*  T.A.R. tampoco: dicta con `expo-speech`. Ninguna de las dos vías se        */
/*  tocaba, así que las dos podían estar mudas con la pantalla en verde.       */
/*                                                                             */
/*  Aquí se vigila que esas dos cadenas se recorran DE VERDAD y que un fallo   */
/*  suyo salga como FALLO.                                                     */
/* -------------------------------------------------------------------------- */

const audioState = {
  decodeOk: true,
  decodedDuration: 0.42,
  started: 0,
};

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
    start = jest.fn(() => {
      audioState.started += 1;
    });
    stop = jest.fn();
  }
  class FakeContext {
    currentTime = 0;
    state = 'running';
    sampleRate = 48000;
    destination = {};
    createBufferSource = () => new FakeNode();
    createGain = () => new FakeNode();
    createStereoPanner = () => new FakeNode();
    createOscillator = () => new FakeNode();
    decodeAudioData = jest.fn(async () => {
      if (!audioState.decodeOk) throw new Error('formato no soportado');
      return { duration: audioState.decodedDuration };
    });
    decodeAudioDataSource = jest.fn(async () => ({ duration: audioState.decodedDuration }));
    resume = jest.fn();
    close = jest.fn();
  }
  return {
    AudioContext: FakeContext,
    AudioRecorder: class {
      onAudioReady() {}
      start() {}
      stop() {}
    },
    AudioManager: { setAudioSessionOptions: jest.fn(), setAudioSessionActivity: jest.fn() },
  };
});

/* Motor de síntesis. `speech.behaviour` decide qué hace con cada locución, y
 * los cuatro casos son los que se ven en un dispositivo real:
 *   · 'speaks'  → onStart + onDone (voz instalada, funciona);
 *   · 'errors'  → onError (voz de red sin cobertura: Android lo notifica);
 *   · 'silent'  → acepta la locución y NO EMITE NADA NI AVISA. Éste es el que
 *     dejaba la pantalla en verde con la app muda, y el que obliga a la sonda
 *     a tener un plazo: sin él se esperaría para siempre;
 *   · 'starts-never-ends' → onStart y ningún cierre dentro del plazo. Es lo
 *     que vio Frank el 4/9/2026, y lo que la pantalla presentaba como fallo
 *     DEL MOTOR sobre una voz local que había empezado a sonar. */
const speech = {
  behaviour: 'speaks' as 'speaks' | 'errors' | 'silent' | 'starts-never-ends',
};

jest.mock('expo-speech', () => ({
  speak: jest.fn((_text: string, opts: any) => {
    if (speech.behaviour === 'speaks') {
      setTimeout(() => {
        opts?.onStart?.();
        opts?.onDone?.();
      }, 0);
    } else if (speech.behaviour === 'errors') {
      setTimeout(() => opts?.onError?.(new Error('network error')), 0);
    } else if (speech.behaviour === 'starts-never-ends') {
      setTimeout(() => opts?.onStart?.(), 0);
    }
    /* 'silent': ni un evento, como el motor real cuando descarta la locución */
  }),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => [
    // Catálogo REAL de expo-speech: cuatro campos, sin banderas de red.
    { identifier: 'es-es-x-eed-network', name: 'es-es-x-eed-network', language: 'es-ES', quality: 'Enhanced' },
    { identifier: 'es-es-x-eed-local', name: 'es-es-x-eed-local', language: 'es-ES', quality: 'Default' },
  ]),
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    isLoaded: true,
    duration: 1.2,
    currentTime: 0.3,
    playing: true,
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  setAudioModeAsync: jest.fn(),
}));

import { __resetSharedAudioContextForTests } from '@/Audio';
import { installVerbalAudioAdapter } from '@/Screens/VerbalAudiometry/verbalAudiometryAudio';
import { speechProbeTimeoutMs } from '@/Screens/VerbalAudiometry/verbalAudiometryAudio';
import {
  LISTEN_CHECK_IDS,
  TEST_PHRASE,
  checkSystemVoiceSpeaks,
  checkVerbalClipChain,
  emitSystemVoiceSample,
  summaryText,
  type CheckResult,
} from '../audioSelfTest';

let uninstall: (() => void) | null = null;

beforeEach(() => {
  __resetSharedAudioContextForTests();
  audioState.decodeOk = true;
  audioState.started = 0;
  speech.behaviour = 'speaks';
});

afterEach(() => {
  uninstall?.();
  uninstall = null;
});

describe('cadena de recortes de la audiometría verbal', () => {
  it('decodifica un recorte REAL y lo programa por la cadena del estímulo', async () => {
    const r = await checkVerbalClipChain();
    expect(r.status).toBe('ok');
    expect(r.detail).toMatch(/0\.42 s/);
    // La palabra se emite de verdad: sin `start()` no hay estímulo que oír.
    expect(audioState.started).toBe(1);
  });

  it('si el decodificador rechaza el recorte, es FALLO y lo dice', async () => {
    audioState.decodeOk = false;
    const r = await checkVerbalClipChain();
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/NO decodificó/);
    expect(audioState.started).toBe(0);
  });

  it('un buffer de duración cero NO se da por bueno', async () => {
    audioState.decodedDuration = 0;
    const r = await checkVerbalClipChain();
    audioState.decodedDuration = 0.42;
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/duración cero/);
  });
});

describe('locución real del sintetizador', () => {
  it('con voz instalada, dicta y da CORRECTO nombrando la voz usada', async () => {
    uninstall = installVerbalAudioAdapter();
    const r = await checkSystemVoiceSpeaks();
    expect(r.status).toBe('ok');
    // Elige la LOCAL, no la de red: es lo que arregla el mutismo de campo.
    expect(r.detail).toMatch(/es-es-x-eed-local/);
    expect(r.detail).toMatch(/sin red/);
  });

  it('si el motor rechaza la locución, es FALLO (no «473 voces, correcto»)', async () => {
    speech.behaviour = 'errors';
    uninstall = installVerbalAudioAdapter();
    const r = await checkSystemVoiceSpeaks();
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/rechazó la locución/);
  });

  it('si el motor acepta y NO emite, la sonda no se cuelga: vence el plazo y es FALLO', async () => {
    // El caso que dejaba la pantalla en verde con la app muda: `speak()` no
    // lanza, no llega ningún evento y nadie se entera. Sin plazo, la sonda
    // esperaría para siempre (aquí se acorta a 80 ms; en el dispositivo son 4 s).
    speech.behaviour = 'silent';
    uninstall = installVerbalAudioAdapter();
    const r = await checkSystemVoiceSpeaks('es', 80);
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/NO llegó a emitir/);
  });

  it('sin adaptador instalado no se presume nada favorable', async () => {
    const r = await checkSystemVoiceSpeaks();
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/adaptador de voz no está instalado/);
  });

  /* ---------------------------------------------------------------------- */
  /*  4/9/2026: «Locución real del sintetizador · FALLO — el motor empezó a  */
  /*  hablar pero no terminó la locución (voz es-es-x-eee-local, sin red)»,  */
  /*  con el consejo de cambiar el motor de síntesis del sistema. El motor   */
  /*  había ARRANCADO y la voz era local: lo que venció fue el plazo de la   */
  /*  sonda, que eran 4 s fijos para una frase de 47 caracteres dictada a    */
  /*  ritmo 0.95 en un emulador donde cargar la primera locución del banco   */
  /*  costó 3,57 s medidos en esa misma corrida.                             */
  /* ---------------------------------------------------------------------- */
  describe('el motor arranca y no confirma el final', () => {
    it('es AVISO, no FALLO, y no acusa al motor de síntesis del sistema', async () => {
      speech.behaviour = 'starts-never-ends';
      uninstall = installVerbalAudioAdapter();
      const r = await checkSystemVoiceSpeaks('es', 80);
      expect(r.status).toBe('warn');
      expect(r.detail).toMatch(/arrancó la locución/);
      // Lo que NO puede volver a decir: que el fallo es del motor.
      expect(r.hint).not.toMatch(/cambiar el motor de síntesis/);
      expect(r.hint).toMatch(/prueba de escucha/);
    });

    it('publica los tiempos que midió, para no volver a deducirlos', async () => {
      speech.behaviour = 'starts-never-ends';
      uninstall = installVerbalAudioAdapter();
      const r = await checkSystemVoiceSpeaks('es', 120);
      expect(r.detail).toMatch(/arrancó a los 0\.0 s/);
      // El plazo era de 120 ms: lo que se comprueba es que el tiempo SE
      // PUBLICA, no su valor exacto (depende de la máquina que corre el test).
      expect(r.detail).toMatch(/no confirmó el final en \d+\.\d s/);
    });

    it('la escucha SIGUE EN PIE: hay algo que oír aunque no llegue el cierre', async () => {
      speech.behaviour = 'starts-never-ends';
      uninstall = installVerbalAudioAdapter();
      // Devolver `false` aquí pintaba «el sintetizador no llegó a emitir» sin
      // preguntar, cerrando en falso la única escucha que responde del T.A.R.
      await expect(emitSystemVoiceSample('es', 80)).resolves.toBe(true);
    });

    it('una locución que SÍ termina dice cuánto tardó', async () => {
      uninstall = installVerbalAudioAdapter();
      const r = await checkSystemVoiceSpeaks();
      expect(r.detail).toMatch(/frase de prueba completa en 0\.0 s/);
    });
  });

  describe('plazo de la sonda', () => {
    it('crece con el texto y con la lentitud del ritmo: no es un número fijo', () => {
      const corta = speechProbeTimeoutMs('Hola.', 1);
      const larga = speechProbeTimeoutMs(TEST_PHRASE, 1);
      expect(larga).toBeGreaterThan(corta);
      // El plazo viejo (4 s) no daba ni para la frase de prueba a ritmo normal.
      expect(larga).toBeGreaterThan(4000);
      // Un ritmo más lento alarga la locución, y con ella el plazo.
      expect(speechProbeTimeoutMs(TEST_PHRASE, 0.5)).toBeGreaterThan(larga);
      // Y hay techo: una consigna larguísima no cuelga la pantalla un minuto.
      expect(speechProbeTimeoutMs('x'.repeat(5000), 0.1)).toBeLessThanOrEqual(20000);
    });
  });
});

describe('resumen copiable', () => {
  const mk = (id: string): CheckResult => ({ id, label: id, status: 'ok', detail: 'x' });

  it('declara que la SALIDA no está comprobada mientras falte alguna escucha', () => {
    const txt = summaryText([mk('engine'), mk('output'), mk('voice-bank')]);
    expect(txt).toMatch(/SALIDA NO COMPROBADA/);
    expect(txt).toMatch(/4 de 4 pruebas de escucha/);
  });

  it('con las cuatro escuchas contestadas ya no advierte', () => {
    const txt = summaryText([mk('engine'), ...LISTEN_CHECK_IDS.map(id => mk(id))]);
    expect(txt).not.toMatch(/SALIDA NO COMPROBADA/);
  });
});
