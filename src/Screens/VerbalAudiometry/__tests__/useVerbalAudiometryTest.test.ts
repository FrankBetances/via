// El hook importa el adaptador de audio, que a su vez importa la librería
// nativa (ESM sin transformar por jest): se sustituye por un esqueleto. En
// este test no se instala ningún adaptador (modo demostración).
jest.mock('react-native-audio-api', () => ({
  AudioContext: class {},
  AudioManager: {
    setAudioSessionOptions: jest.fn(),
    setAudioSessionActivity: jest.fn(),
  },
}));

import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

import { useVerbalAudiometryTest } from '../useVerbalAudiometryTest';
import { scoredItemsOfBand } from '../verbalAudiometryLists';

/* -------------------------------------------------------------------------- */
/*  Flujo de láminas del motor clínico (sin adaptador de audio: modo demo).    */
/*                                                                             */
/*  Regresión del salto tras la familiarización: al marcar `practiceDone`,     */
/*  `presentation` se recalcula sin la lámina de práctica y la primera         */
/*  puntuable pasa al índice 0; `next()` además incrementaba el índice y esa   */
/*  lámina nunca se presentaba (7 de 8 en la banda A).                         */
/* -------------------------------------------------------------------------- */

type Hook = ReturnType<typeof useVerbalAudiometryTest>;

const renderTestHook = () => {
  const result = { current: null as unknown as Hook };
  const Harness = () => {
    result.current = useVerbalAudiometryTest();
    return null;
  };
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(Harness));
  });
  return { result, unmount: () => act(() => renderer.unmount()) };
};

/** Presenta el estímulo, responde con la palabra objetivo y avanza. */
const answerCurrent = (result: { current: Hook }) => {
  act(() => result.current.playStimulus());
  act(() => result.current.choose(result.current.item!.targetWord));
  act(() => result.current.next());
};

describe('useVerbalAudiometryTest — flujo de láminas', () => {
  it('tras la familiarización presenta TODAS las puntuables (sin saltarse la primera)', () => {
    const { result, unmount } = renderTestHook();
    const scoredCount = scoredItemsOfBand('A').length;

    expect(result.current.isPractice).toBe(true);
    answerCurrent(result); // familiarización (no puntúa)

    // La lista sin práctica arranca por su primera lámina, no por la segunda.
    expect(result.current.isPractice).toBe(false);
    expect(result.current.itemIndex).toBe(0);
    expect(result.current.itemTotal).toBe(scoredCount);

    for (let i = 0; i < scoredCount; i++) {
      expect(result.current.item).not.toBeNull();
      answerCurrent(result);
    }

    expect(result.current.completedForLevel).toBe(true);
    expect(result.current.score.presentedCount).toBe(scoredCount); // antes: scoredCount − 1
    expect(result.current.score.correctCount).toBe(scoredCount);
    unmount();
  });

  it('la práctica no puntúa y una pasada repetida al mismo nivel re-presenta la lista completa', () => {
    const { result, unmount } = renderTestHook();
    const scoredCount = scoredItemsOfBand('A').length;

    answerCurrent(result); // familiarización
    expect(result.current.score.presentedCount).toBe(0); // la práctica no cuenta

    for (let i = 0; i < scoredCount; i++) answerCurrent(result);
    expect(result.current.completedForLevel).toBe(true);

    act(() => result.current.resetRun());
    expect(result.current.itemIndex).toBe(0);
    expect(result.current.isPractice).toBe(false); // sin repetir la familiarización
    expect(result.current.itemTotal).toBe(scoredCount);
    unmount();
  });
});
