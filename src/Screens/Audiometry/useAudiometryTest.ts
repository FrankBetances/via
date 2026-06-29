import { useCallback, useRef, useState } from 'react';
import {
  AudiometryThresholds,
  Ear,
} from '@/Models/Audiometry/AudiometryTest';
import { cloneThresholds, emptyThresholds, FREQS, pta } from './audiometryResult';

/* -------------------------------------------------------------------------- */
/*  Adaptador de audio (tono puro calibrado).                                  */
/*                                                                            */
/*  La generación de tonos calibrados en dB HL requiere audio nativo          */
/*  (ficheros calibrados o un sintetizador). Registre un adaptador en el       */
/*  arranque de la app:                                                        */
/*                                                                            */
/*    import { setAudiometryToneAdapter } from '@/Screens/Audiometry';         */
/*    setAudiometryToneAdapter({                                              */
/*      playTone: (freqHz, dbHL, ear) => { ...reproducir tono calibrado... },  */
/*      stop: () => { ...detener... },                                         */
/*    });                                                                     */
/*                                                                            */
/*  El paquete ya incluye un adaptador REAL en `audiometryToneAdapter.ts`      */
/*  basado en react-native-audio-api (Oboe en Android). Para activarlo basta:  */
/*    import { installAudiometryToneAdapter } from '@/Screens/Audiometry';     */
/*    useEffect(() => installAudiometryToneAdapter(), []);                      */
/*                                                                            */
/*  Sin adaptador, la pantalla funciona en modo demostración: la UI/flujo      */
/*  clínico y el refuerzo visual operan, sin emisión real de sonido.           */
/* -------------------------------------------------------------------------- */

export type ToneTarget = number | 'amb' | 'pol';

export interface AudiometryToneAdapter {
  playTone: (freq: ToneTarget, dbHL: number, ear: Ear) => void;
  stop: () => void;
}

let toneAdapter: AudiometryToneAdapter | null = null;
export const setAudiometryToneAdapter = (a: AudiometryToneAdapter | null) => {
  toneAdapter = a;
};

const TONE_MS = 1400;

interface TallyEar {
  [freq: number]: number;
}

export interface AudiometryState {
  ear: Ear;
  freq: ToneTarget;
  db: number;
  playing: boolean;
}

/**
 * Hook de la audiometría tonal condicionada (Hughson-Westlake guiado).
 * Comparte el motor clínico entre la pantalla infantil (instrumentos) y la
 * condicionada (tren). El refuerzo visual lo añade cada pantalla.
 */
export function useAudiometryTest() {
  const [ear, setEar] = useState<Ear>('OD');
  const [freq, setFreq] = useState<ToneTarget>(1000);
  const [db, setDb] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [thresholds, setThresholds] = useState<AudiometryThresholds>(() => emptyThresholds());
  const [stars, setStars] = useState(0);
  const [presentations, setPresentations] = useState(0);
  const [consistent, setConsistent] = useState(0);
  const [lastConfirmed, setLastConfirmed] = useState<{ ear: Ear; freq: number; db: number } | null>(null);

  // tallies internos del algoritmo (no necesitan re-render)
  const minHeard = useRef<Record<Ear, TallyEar>>({ OD: {}, OI: {} });
  const heardCount = useRef<Record<Ear, TallyEar>>({ OD: {}, OI: {} });
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    toneAdapter?.stop();
    setPlaying(false);
  }, []);

  const playStimulus = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    setPlaying(true);
    toneAdapter?.playTone(freq, db, ear);
    stopTimer.current = setTimeout(() => {
      toneAdapter?.stop();
      setPlaying(false);
    }, typeof freq === 'number' ? TONE_MS : 2000);
  }, [freq, db, ear]);

  /** Registra una respuesta (oyó el tono): aplica el descenso/confirmación HW. */
  const responded = useCallback((): { confirmed: boolean } => {
    if (typeof freq !== 'number') return { confirmed: false };
    let confirmed = false;
    setPresentations(p => p + 1);
    setConsistent(c => c + 1);

    const prevMin = minHeard.current[ear][freq] ?? null;
    if (prevMin === null || db < prevMin) {
      minHeard.current[ear][freq] = db;
      heardCount.current[ear][freq] = 1;
    } else if (db === prevMin) {
      heardCount.current[ear][freq] = (heardCount.current[ear][freq] ?? 0) + 1;
    }

    const already = thresholds[ear][freq] !== null;
    if (!already && (heardCount.current[ear][freq] ?? 0) >= 2) {
      const level = minHeard.current[ear][freq]!;
      setThresholds(t => {
        const next = cloneThresholds(t);
        next[ear][freq] = level;
        return next;
      });
      setStars(s => s + 1);
      setLastConfirmed({ ear, freq, db: level });
      confirmed = true;
    } else if (!already) {
      setDb(d => Math.max(20, d - 10)); // desciende 10 dB
    }
    return { confirmed };
  }, [ear, freq, db, thresholds]);

  /** Registra una no-respuesta: sube 5 dB (HW). */
  const noResponse = useCallback(() => {
    setPresentations(p => p + 1);
    if (typeof freq !== 'number') return;
    setDb(d => Math.min(80, d + 5));
  }, [freq]);

  const reset = useCallback(() => {
    stop();
    minHeard.current = { OD: {}, OI: {} };
    heardCount.current = { OD: {}, OI: {} };
    setEar('OD');
    setFreq(1000);
    setDb(40);
    setThresholds(emptyThresholds());
    setStars(0);
    setPresentations(0);
    setConsistent(0);
    setLastConfirmed(null);
  }, [stop]);

  const ptaOD = pta(thresholds.OD);
  const ptaOI = pta(thresholds.OI);
  const reliability = presentations > 0 ? Math.round((consistent / presentations) * 100) : null;
  const isControl = typeof freq !== 'number';
  const currentThreshold = isControl ? null : thresholds[ear][freq as number];
  const heardAtMin = isControl ? null : minHeard.current[ear][freq as number] ?? null;
  const heardTally = isControl ? 0 : heardCount.current[ear][freq as number] ?? 0;
  const doneForEar = (e: Ear) => FREQS.filter(f => thresholds[e][f] !== null).length;

  return {
    // estado
    ear,
    freq,
    db,
    playing,
    thresholds,
    stars,
    presentations,
    reliability,
    ptaOD,
    ptaOI,
    isControl,
    currentThreshold,
    heardAtMin,
    heardTally,
    lastConfirmed,
    hasTone: !!toneAdapter,
    // selectores
    setEar,
    setFreq,
    setDb,
    // acciones
    playStimulus,
    stop,
    responded,
    noResponse,
    reset,
    // helpers
    doneForEar,
  };
}
