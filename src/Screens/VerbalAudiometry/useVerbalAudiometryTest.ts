import { useCallback, useMemo, useRef, useState } from 'react';

import {
  AgeBand,
  DEFAULT_LEVEL,
  MAX_REPEATS,
  VerbalMode,
  VerbalResults,
  computeReliability,
  computeVerbalScore,
  estimateSrtDb,
  resultKey,
} from './verbalAudiometryResult';
import {
  VerbalCardOption,
  VerbalItem,
  bandDef,
  practiceItemOfBand,
  scoredItemsOfBand,
  shuffleItems,
  shuffleOptions,
} from './verbalAudiometryLists';
import { getVerbalAudioAdapter } from './verbalAudiometryAudio';

/* -------------------------------------------------------------------------- */
/*  Hook de estado de la Audiometría Verbal (motor clínico, sin UI).           */
/*                                                                             */
/*  Gobierna el flujo por lámina: familiarización (no puntúa) → láminas        */
/*  puntuables barajadas por semilla de sesión → posibilidad de repetir la     */
/*  pasada a otro nivel (resultados por ítem@nivel independientes). La         */
/*  presentación exige estímulo antes de elegir; las repeticiones se           */
/*  registran como ayuda y penalizan la fiabilidad orientativa.                */
/*                                                                             */
/*  Sin adaptador de audio registrado, funciona en modo demostración (igual    */
/*  que `useAudiometryTest`): el flujo clínico opera sin emisión de sonido.    */
/* -------------------------------------------------------------------------- */

/** Duración estimada del recorte hablado (corte del estado `playing`). */
const WORD_MS = 1800;

export function useVerbalAudiometryTest(initialBand: AgeBand = 'A') {
  const [band, setBandState] = useState<AgeBand>(initialBand);
  const [mode, setMode] = useState<VerbalMode>('discrimination');
  const [level, setLevelState] = useState<number>(DEFAULT_LEVEL);
  // Semilla de sesión: reproducible dentro de la sesión, distinta entre sesiones.
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 0xffffffff));

  const [itemIndex, setItemIndex] = useState(0);
  const [practiceDone, setPracticeDone] = useState(false);
  const [results, setResults] = useState<VerbalResults>({});
  const [played, setPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [repeats, setRepeats] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);

  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ------------------------------ lámina actual --------------------------- */

  // Orden de presentación: familiarización (solo la primera pasada) + puntuables
  // barajadas con la semilla de sesión mezclada con el nivel (orden distinto en
  // cada pasada de nivel, para evitar aprendizaje posicional).
  const presentation = useMemo<VerbalItem[]>(() => {
    const scored = shuffleItems(scoredItemsOfBand(band), seed + level);
    if (practiceDone) return scored;
    const practice = practiceItemOfBand(band);
    return practice ? [practice, ...scored] : scored;
  }, [band, seed, level, practiceDone]);

  const item: VerbalItem | null = presentation[itemIndex] ?? null;
  const isPractice = !!item?.practice;

  // Opciones barajadas de la lámina actual (orden propio por lámina y nivel).
  const options = useMemo<VerbalCardOption[]>(
    () => (item ? shuffleOptions(item, seed + level) : []),
    [item, seed, level],
  );

  const answered = chosen !== null;
  const wasCorrect = answered && item ? chosen === item.targetWord : null;
  const completedForLevel =
    practiceDone && presentation.length > 0 && itemIndex >= presentation.length;

  /* -------------------------------- estímulo ------------------------------ */

  const stop = useCallback(() => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    getVerbalAudioAdapter()?.stop();
    setPlaying(false);
  }, []);

  const emit = useCallback(() => {
    if (!item) return;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    setPlaying(true);
    getVerbalAudioAdapter()?.playWord(item.audio, item.targetWord, level);
    stopTimer.current = setTimeout(() => setPlaying(false), WORD_MS);
  }, [item, level]);

  /** Primera presentación del estímulo de la lámina (habilita las tarjetas). */
  const playStimulus = useCallback(() => {
    if (!item || answered) return;
    setPlayed(true);
    emit();
  }, [item, answered, emit]);

  /** Repetición del estímulo (ayuda registrada, máx. MAX_REPEATS). */
  const repeatStimulus = useCallback(() => {
    if (!item || !played || answered || repeats >= MAX_REPEATS) return;
    setRepeats(r => r + 1);
    emit();
  }, [item, played, answered, repeats, emit]);

  /* -------------------------------- respuesta ----------------------------- */

  /** Selección de una tarjeta. Solo puntúa en láminas no-práctica. */
  const choose = useCallback(
    (word: string) => {
      if (!item || !played || answered) return;
      stop();
      setChosen(word);
      if (!item.practice) {
        const correct = word === item.targetWord;
        setResults(prev => ({
          ...prev,
          [resultKey(item.id, level)]: {
            itemId: item.id,
            level,
            chosenWord: word,
            correct,
            repeats,
          },
        }));
      }
    },
    [item, played, answered, level, repeats, stop],
  );

  /** Avanza a la siguiente lámina (tras responder). */
  const next = useCallback(() => {
    if (!answered) return;
    stop();
    if (isPractice) {
      // Fin de la familiarización: `presentation` se recalcula SIN la lámina
      // de práctica y la primera puntuable pasa a ocupar el índice 0. Avanzar
      // a 1 aquí la saltaba (se presentaban 7 de 8 láminas).
      setPracticeDone(true);
      setItemIndex(0);
    } else {
      setItemIndex(i => i + 1);
    }
    setPlayed(false);
    setRepeats(0);
    setChosen(null);
  }, [answered, isPractice, stop]);

  /* ------------------------------ configuración --------------------------- */

  const resetRun = useCallback(() => {
    stop();
    setItemIndex(0);
    setPlayed(false);
    setRepeats(0);
    setChosen(null);
  }, [stop]);

  /** Cambia la banda (override manual del profesional): borra la pasada. */
  const setBand = useCallback(
    (b: AgeBand) => {
      if (b === band) return;
      setBandState(b);
      setResults({});
      setPracticeDone(false);
      resetRun();
    },
    [band, resetRun],
  );

  /**
   * Cambia el nivel de presentación. Los resultados de otros niveles se
   * conservan (clave ítem@nivel): permite la segunda pasada a voz baja o los
   * bloques descendentes del modo umbral.
   */
  const setLevel = useCallback(
    (l: number) => {
      if (l === level) return;
      setLevelState(l);
      resetRun();
    },
    [level, resetRun],
  );

  /** Reinicio completo de la prueba (nueva semilla de sesión). */
  const reset = useCallback(() => {
    setResults({});
    setPracticeDone(false);
    setSeed(Math.floor(Math.random() * 0xffffffff));
    setLevelState(DEFAULT_LEVEL);
    setMode('discrimination');
    resetRun();
  }, [resetRun]);

  /* -------------------------------- derivados ----------------------------- */

  const score = useMemo(() => computeVerbalScore(results), [results]);
  const reliability = useMemo(() => computeReliability(results), [results]);
  const srtDb = useMemo(
    () => (mode === 'threshold' ? estimateSrtDb(score.levelScores) : null),
    [mode, score.levelScores],
  );

  const adapter = getVerbalAudioAdapter();
  const def = bandDef(band);

  return {
    // configuración
    band,
    setBand,
    bandDef: def,
    modality: def.modality,
    mode,
    setMode,
    level,
    setLevel,
    // lámina actual
    item,
    options,
    isPractice,
    itemIndex,
    itemTotal: presentation.length,
    completedForLevel,
    // estado de presentación/respuesta
    played,
    playing,
    repeats,
    canRepeat: played && !answered && repeats < MAX_REPEATS,
    chosen,
    wasCorrect,
    // resultados
    results,
    score,
    reliability,
    srtDb,
    // audio
    hasAudio: !!adapter,
    audioEngine: adapter?.engine ?? null,
    // acciones
    playStimulus,
    repeatStimulus,
    choose,
    next,
    stop,
    reset,
    /** Reinicia solo la pasada actual (índice de lámina): permite repetir la
     *  lista al MISMO nivel; las respuestas re-presentadas sobrescriben su
     *  clave ítem@nivel. */
    resetRun,
  };
}
