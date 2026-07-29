import { act, renderHook } from '@testing-library/react-native';

import { setVerbalAudioAdapter, type VerbalAudioAdapter } from '../verbalAudiometryAudio';
import { AUTOPLAY_DELAY_MS, useVerbalAudiometryTest } from '../useVerbalAudiometryTest';

/* -------------------------------------------------------------------------- */
/*  Auto-presentación del estímulo.                                            */
/*                                                                             */
/*  Regresión del bug de campo «la voz no se dispara de forma automática, solo */
/*  suena tras presionar las tarjetas». El temporizador vivía en la PANTALLA y */
/*  dependía de valores que cambian de identidad en cada render (el objeto de  */
/*  la lámina, la función de presentación). Cualquier re-render —cambio de     */
/*  idioma, de banda, telemetría— remontaba el efecto y su `clearTimeout`      */
/*  cancelaba la emisión pendiente: la lámina se quedaba muda y había que      */
/*  pulsar «repetir».                                                          */
/*                                                                             */
/*  Ahora la regla vive en el hook y depende SOLO de datos, así que se puede   */
/*  probar de verdad — que es la razón por la que el fallo sobrevivió a varias */
/*  correcciones «a ojo».                                                      */
/* -------------------------------------------------------------------------- */

const played: Array<{ audioKey: string; word: string; lang?: string }> = [];

const fakeAdapter = (): VerbalAudioAdapter => ({
  playWord: (audioKey, word, _levelDb, lang) => played.push({ audioKey, word, lang }),
  prime: jest.fn(),
  stop: jest.fn(),
  engine: 'assets',
});

describe('auto-presentación del estímulo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    played.length = 0;
    setVerbalAudioAdapter(fakeAdapter());
  });

  afterEach(() => {
    jest.useRealTimers();
    setVerbalAudioAdapter(null);
  });

  /** Arranca la fase de juego y deja pasar el retardo de auto-presentación. */
  const startAndAdvance = (result: { current: ReturnType<typeof useVerbalAudiometryTest> }) => {
    act(() => result.current.setRunning(true));
    act(() => {
      jest.advanceTimersByTime(AUTOPLAY_DELAY_MS + 50);
    });
  };

  it('la palabra suena SOLA al entrar en la lámina, sin tocar nada', () => {
    const { result } = renderHook(() => useVerbalAudiometryTest('A', 'es'));
    expect(played).toHaveLength(0);

    startAndAdvance(result);

    expect(played).toHaveLength(1);
    expect(played[0].audioKey).toBe(result.current.item!.audio);
    // Y las tarjetas quedan habilitadas porque el estímulo ya sonó.
    expect(result.current.played).toBe(true);
  });

  it('no suena mientras la prueba no está en marcha', () => {
    const { result } = renderHook(() => useVerbalAudiometryTest('A', 'es'));
    act(() => {
      jest.advanceTimersByTime(AUTOPLAY_DELAY_MS * 3);
    });
    expect(played).toHaveLength(0);
    expect(result.current.played).toBe(false);
  });

  it('un re-render durante la espera NO cancela la emisión pendiente', () => {
    // El corazón del bug: la pantalla se re-renderiza constantemente (telemetría,
    // estado de la UI) y eso reiniciaba el temporizador una y otra vez.
    const { result, rerender } = renderHook(() => useVerbalAudiometryTest('A', 'es'));
    act(() => result.current.setRunning(true));

    for (let i = 0; i < 6; i++) {
      act(() => {
        jest.advanceTimersByTime(AUTOPLAY_DELAY_MS / 4);
      });
      rerender({});
    }
    act(() => {
      jest.advanceTimersByTime(AUTOPLAY_DELAY_MS);
    });

    expect(played).toHaveLength(1);
  });

  it('cada lámina nueva se presenta sola tras responder la anterior', () => {
    const { result } = renderHook(() => useVerbalAudiometryTest('A', 'es'));
    startAndAdvance(result);
    expect(played).toHaveLength(1);

    act(() => result.current.choose(result.current.item!.targetWord));
    act(() => result.current.next());
    act(() => {
      jest.advanceTimersByTime(AUTOPLAY_DELAY_MS + 50);
    });

    expect(played).toHaveLength(2);
    expect(played[1].audioKey).not.toBe(played[0].audioKey);
  });

  it('no se repite sola mientras la lámina sigue sin responder', () => {
    const { result } = renderHook(() => useVerbalAudiometryTest('A', 'es'));
    startAndAdvance(result);
    act(() => {
      jest.advanceTimersByTime(AUTOPLAY_DELAY_MS * 5);
    });
    expect(played).toHaveLength(1); // repetir es una acción deliberada del clínico
  });

  it('al salir de la fase de juego deja de presentarse sola', () => {
    const { result } = renderHook(() => useVerbalAudiometryTest('A', 'es'));
    act(() => result.current.setRunning(true));
    act(() => result.current.setRunning(false));
    act(() => {
      jest.advanceTimersByTime(AUTOPLAY_DELAY_MS * 3);
    });
    expect(played).toHaveLength(0);
  });

  it('presenta la lámina en el idioma de la sesión (el recorte que toca)', () => {
    const { result } = renderHook(() => useVerbalAudiometryTest('A', 'gl'));
    startAndAdvance(result);
    expect(played[0].lang).toBe('gl');
  });
});
