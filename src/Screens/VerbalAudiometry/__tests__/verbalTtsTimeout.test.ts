/* -------------------------------------------------------------------------- */
/*  PLAZOS DE LA LOCUCIÓN DEL ESTÍMULO VERBAL.                                 */
/*                                                                             */
/*  `speakWord` no tenía plazo: si el motor aceptaba la palabra y no emitía    */
/*  ninguno de sus tres eventos (`onDone`, `onStopped`, `onError`), la promesa */
/*  quedaba pendiente PARA SIEMPRE. Ni resolvía ni rechazaba, así que esa      */
/*  palabra no degradaba a su recorte, el contador de fallos no se movía y la  */
/*  prueba seguía adelante con un ítem que no había sonado. Un fallo mudo en   */
/*  mitad de una audiometría.                                                  */
/*                                                                             */
/*  El plazo es DOBLE, y la razón está en el estímulo, no en el motor:         */
/*   · sin `onStart` no ha salido voz por el altavoz → degradar al recorte es  */
/*     seguro, y es lo que hay que hacer;                                      */
/*   · con `onStart` el motor YA está emitiendo → reproducir el recorte encima */
/*     solaparía dos estímulos sobre el mismo ítem, que es peor que el         */
/*     silencio porque lo invalida sin que nadie se entere.                    */
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
  class FakeContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createBufferSource = () => new FakeSource();
    createGain = () => new FakeNode();
    createStereoPanner = () => new FakeNode();
    decodeAudioData = jest.fn(async () => ({ duration: 1 }));
    decodeAudioDataSource = jest.fn(async () => ({ duration: 1 }));
    resume = jest.fn();
    close = jest.fn();
  }
  return {
    AudioContext: FakeContext,
    AudioManager: { setAudioSessionOptions: jest.fn(), setAudioSessionActivity: jest.fn() },
    __starts: starts,
  };
});

/* Los tres motores que se ven en un dispositivo, por lo que HACEN con la
 * locución: la cierra, la arranca y no la cierra, o no la toca nunca. */
const tts = { behaviour: 'closes' as 'closes' | 'starts-never-ends' | 'never-answers' };

jest.mock('expo-speech', () => ({
  speak: jest.fn((_text: string, opts: any) => {
    if (tts.behaviour === 'closes') {
      setTimeout(() => {
        opts?.onStart?.();
        opts?.onDone?.();
      }, 0);
    } else if (tts.behaviour === 'starts-never-ends') {
      setTimeout(() => opts?.onStart?.(), 0);
    }
    /* 'never-answers': el motor acepta la palabra y no vuelve a hablar */
  }),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => [
    { identifier: 'es-es-x-eed-local', name: 'Español', language: 'es-ES', quality: 'Enhanced' },
  ]),
}));

import { getVerbalAudioAdapter, installVerbalAudioAdapter } from '../verbalAudiometryAudio';

const audioApi = jest.requireMock('react-native-audio-api') as { __starts: unknown[] };
const Tts = jest.requireMock('expo-speech') as any;

/** Vacía la cola de microtareas sin mover el reloj falso. */
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** Mueve el reloj falso y deja que las promesas que dependen de él avancen. */
const advance = async (ms: number) => {
  jest.advanceTimersByTime(ms);
  await flush();
};

const assetBase64 = () => 'QUFBQQ==';

describe('audiometría verbal · plazo de la locución del estímulo', () => {
  let cleanup: (() => void) | null = null;

  const install = async () => {
    // Vía TTS primaria (la de las lenguas sin recortes propios) CON recorte de
    // respaldo disponible: es la configuración en la que la degradación —o su
    // ausencia— se puede observar.
    cleanup = installVerbalAudioAdapter({ preferTts: true, assetBase64 });
    await flush();
    return getVerbalAudioAdapter()!;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    audioApi.__starts.length = 0;
    Tts.speak.mockClear();
    Tts.stop.mockClear();
    tts.behaviour = 'closes';
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    jest.useRealTimers();
  });

  it('un motor que NO arranca degrada la palabra a su recorte, y no espera indefinidamente', async () => {
    tts.behaviour = 'never-answers';
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65, 'es');
    await advance(0);
    // Antes de que venza el plazo no se degrada: el motor todavía puede hablar.
    expect(audioApi.__starts).toHaveLength(0);

    await advance(4000);
    expect(audioApi.__starts).toHaveLength(1);
    // Y la locución encolada se cancela ANTES de soltar el recorte: sin esto un
    // motor lento la arrancaría encima del estímulo que ya está sonando.
    expect(Tts.stop).toHaveBeenCalled();
  });

  it('un motor que arranca y no cierra NO degrada: dos estímulos solapados invalidan el ítem', async () => {
    tts.behaviour = 'starts-never-ends';
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65, 'es');
    await advance(0);
    // Diez segundos después —muy por encima de los dos plazos— la palabra ha
    // sonado por el motor y el recorte NO se ha reproducido encima.
    await advance(10000);
    expect(audioApi.__starts).toHaveLength(0);
  });

  it('un motor que arranca y no cierra tampoco se da por sano: la sesión no se declara buena', async () => {
    // El contador de fallos no se toca en ese desenlace, ni para bien ni para
    // mal: no hay veredicto. Se observa por la vía que sigue eligiendo.
    tts.behaviour = 'starts-never-ends';
    const adapter = await install();
    for (const w of ['pato', 'casa', 'mesa']) {
      adapter.playWord(w, w, 65, 'es');
      // El primer avance deja que `ensureTtsReady` arme los plazos; el
      // segundo los vence. Al revés, el reloj se movería antes de que los
      // temporizadores existan y el test pasaría sin probar nada.
      await advance(0);
      await advance(10000);
    }
    expect(Tts.speak).toHaveBeenCalledTimes(3);
    expect(audioApi.__starts).toHaveLength(0);
  });

  it('dos palabras que el motor no arranca degradan la SESIÓN a recortes', async () => {
    // Comportamiento ya existente (TTS_FAILURE_LIMIT), que el plazo nuevo hace
    // alcanzable: sin él, un motor mudo nunca llegaba a contar un solo fallo.
    tts.behaviour = 'never-answers';
    const adapter = await install();
    for (const w of ['pato', 'casa']) {
      adapter.playWord(w, w, 65, 'es');
      await advance(0);
      await advance(4000);
    }
    expect(Tts.speak).toHaveBeenCalledTimes(2);

    Tts.speak.mockClear();
    adapter.playWord('mesa', 'mesa', 65, 'es');
    await advance(0);
    // La tercera ya no pasa por el motor: va directa al recorte.
    expect(Tts.speak).not.toHaveBeenCalled();
    expect(audioApi.__starts).toHaveLength(3);
  });

  it('el plazo de una palabra no sobrevive a la palabra siguiente', async () => {
    // La trampa de poner plazos: el motor que acepta y no contesta tampoco
    // emite `onStopped` cuando se le para, así que el plazo de la palabra
    // anterior seguiría vivo y soltaría SU recorte encima de la lámina que el
    // clínico ya está presentando.
    tts.behaviour = 'never-answers';
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65, 'es');
    await advance(0);
    await advance(1000);

    adapter.playWord('casa', 'casa', 65, 'es');
    await advance(0);
    await advance(4000);

    // Solo suena el recorte de 'casa': el de 'pato' quedó cancelado con ella.
    expect(audioApi.__starts).toHaveLength(1);
  });

  it('con el motor sano no cambia nada: la palabra suena por el TTS y el recorte no', async () => {
    const adapter = await install();
    adapter.playWord('pato', 'pato', 65, 'es');
    await advance(0);
    expect(Tts.speak).toHaveBeenCalledTimes(1);
    expect(audioApi.__starts).toHaveLength(0);
  });
});
