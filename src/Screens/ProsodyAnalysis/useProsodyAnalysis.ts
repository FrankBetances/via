import { useCallback, useEffect, useRef, useState } from 'react';

import type { RecorderHealth } from '@/Audio';
import type { ProsodyResult } from './prosodyDsp';

/* -------------------------------------------------------------------------- */
/*  Estado del módulo de prosodia (B4).                                        */
/*                                                                            */
/*  Mismo patrón de inyección que `useVoiceAnalysis`: el hook no importa nada  */
/*  nativo, y el adaptador real (`prosodyMicAdapter`) se registra al montar la */
/*  pantalla. Así el estado se puede ejercitar en pruebas con un adaptador     */
/*  falso, sin cargar el motor de audio.                                       */
/* -------------------------------------------------------------------------- */

/** Realimentación en vivo durante la toma. */
export interface ProsodyLiveFrame {
  /** Nivel de la ventana actual (RMS lineal). */
  rms: number;
  /** Segundos transcurridos desde que arrancó la toma. */
  elapsedSec: number;
  /**
   * Segundos ACUMULADOS con habla, estimados en vivo.
   *
   * Es una GUÍA para el explorador, no la medida: el umbral en vivo se calcula
   * sobre el pico visto hasta ahora, mientras que el análisis final lo calcula
   * sobre el percentil 99 de la toma completa. La cifra del informe siempre es
   * la del análisis, nunca esta.
   */
  speechSec: number;
  /** La señal ha tocado techo: la toma se distorsiona y no es analizable. */
  clipping: boolean;
}

export interface ProsodyMicAdapter {
  sampleRate: number;
  startRecording: (onLive?: (frame: ProsodyLiveFrame) => void) => Promise<void>;
  stopRecording: () => Promise<Float32Array>;
  analyse: (pcm: Float32Array) => Promise<ProsodyResult>;
  /** ¿Ha entregado el micrófono algún bloque? Distingue «no habló» de «no captura». */
  hasSignal: () => boolean;
  /**
   * Estado del motor de captura tras la toma. Permite decir POR QUÉ no hubo
   * audio (sin permiso, sin motor, stream mudo) en vez de un aviso genérico.
   * Opcional para no romper adaptadores de prueba ya escritos.
   */
  health?: () => RecorderHealth;
}

let micAdapter: ProsodyMicAdapter | null = null;

/* AVISO DE REGISTRO — el fallo «el módulo de prosodia dice que no detecta
 * micrófono».
 *
 * La pantalla registra su adaptador en un `useEffect`, o sea DESPUÉS del primer
 * render. El `useEffect` del hook está declarado ANTES (el hook se invoca en la
 * primera línea del componente), así que corre primero y siempre veía
 * `micAdapter === null`. Sin nadie que avisara del registro posterior,
 * `available` se quedaba en `false` PARA SIEMPRE: la pantalla pintaba «No hay
 * micrófono disponible en este dispositivo» y dejaba el botón de iniciar toma
 * deshabilitado, en un equipo con micrófono perfectamente funcional.
 *
 * No era una carrera ni un fallo intermitente: era determinista, y desmontar y
 * volver a entrar no lo arreglaba porque al salir el adaptador se desregistra.
 * Es el mismo defecto que ya se corrigió en el análisis de voz
 * (`useVoiceAnalysis`) y en el T.A.R.; aquí faltaba la mitad que avisa. */
const micListeners = new Set<() => void>();

export const setProsodyMicAdapter = (adapter: ProsodyMicAdapter | null) => {
  micAdapter = adapter;
  micListeners.forEach(listener => listener());
};

export const getProsodyMicAdapter = (): ProsodyMicAdapter | null => micAdapter;

/* -------------------------------------------------------------------------- */
/*  Objetivos de la toma (decisión B0.1)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Habla acumulada (s) que se considera muestra suficiente.
 *
 * B0.1 fija 30–60 s de habla conectada **válida**, descontando pausas — de ahí
 * que el contador sea de habla y no de reloj: si el niño calla veinte segundos,
 * el cronómetro de pared miente sobre lo que hay para analizar.
 */
export const TARGET_SPEECH_SEC = 30;

/** Habla mínima por debajo de la cual la toma no se ofrece como analizable. */
export const MIN_SPEECH_SEC = 15;

/**
 * Tope duro de la toma (s). Dos motivos, y ninguno es técnico del todo: la
 * memoria (120 s a 16 kHz en Float32 son ~7.7 MB) y la atención de un niño de
 * cinco años, que se agota mucho antes que la memoria.
 */
export const MAX_TAKE_SEC = 120;

export type ProsodyPhase =
  | 'idle'        // sin toma
  | 'recording'   // capturando
  | 'analysing'   // procesando la toma
  | 'done'        // hay resultado
  | 'error';      // el micrófono no entregó audio

/** Motivos por los que una toma no sirve. Se calculan DURANTE la captura. */
export interface ProsodyTakeIssues {
  /** No se alcanzó el mínimo de habla acumulada. */
  tooLittleSpeech: boolean;
  /** La señal tocó techo en algún momento. */
  clipping: boolean;
  /** El micrófono no entregó ningún bloque. */
  noSignal: boolean;
}

export interface ProsodyAnalysisState {
  phase: ProsodyPhase;
  elapsedSec: number;
  speechSec: number;
  level: number;
  clipping: boolean;
  /** ¿Se alcanzó el objetivo de muestra? */
  enough: boolean;
  result: ProsodyResult | null;
  issues: ProsodyTakeIssues;
  available: boolean;
  /** Estado del motor de captura tras la última toma (para explicar el fallo). */
  micHealth: RecorderHealth;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

const NO_ISSUES: ProsodyTakeIssues = {
  tooLittleSpeech: false,
  clipping: false,
  noSignal: false,
};

export function useProsodyAnalysis(): ProsodyAnalysisState {
  const [phase, setPhase] = useState<ProsodyPhase>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [speechSec, setSpeechSec] = useState(0);
  const [level, setLevel] = useState(0);
  const [clipping, setClipping] = useState(false);
  const [result, setResult] = useState<ProsodyResult | null>(null);
  const [issues, setIssues] = useState<ProsodyTakeIssues>(NO_ISSUES);
  /* La disponibilidad va en ESTADO y no solo en una ref porque se resuelve en
   * el `useEffect` de montaje —después del primer render— y mutar una ref no
   * repinta: con la bandera solo en refs, la pantalla se quedaría pintada para
   * siempre con «sin micrófono». Es el mismo fallo que ya se corrigió en el
   * módulo T.A.R. */
  const [available, setAvailable] = useState<boolean>(() => Boolean(getProsodyMicAdapter()));
  /** Motivo de la última toma sin audio, para que la pantalla lo explique. */
  const [micHealth, setMicHealth] = useState<RecorderHealth>('unknown');

  const speechRef = useRef(0);
  const clippingRef = useRef(false);
  const stoppingRef = useRef(false);
  /** Evita tocar estado tras desmontar (la toma puede cerrarse sola por tope). */
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Suscripción al registro del adaptador: la pantalla lo registra en su
    // propio `useEffect`, que corre DESPUÉS de este. Sin el aviso, `available`
    // se quedaba en `false` para siempre (ver la nota de `setProsodyMicAdapter`).
    const listener = () => setAvailable(Boolean(micAdapter));
    micListeners.add(listener);
    listener();
    return () => {
      micListeners.delete(listener);
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setElapsedSec(0);
    setSpeechSec(0);
    setLevel(0);
    setClipping(false);
    setResult(null);
    setIssues(NO_ISSUES);
    setMicHealth('unknown');
    speechRef.current = 0;
    clippingRef.current = false;
    stoppingRef.current = false;
  }, []);

  const stop = useCallback(async () => {
    const adapter = getProsodyMicAdapter();
    if (!adapter || stoppingRef.current) return;
    stoppingRef.current = true;

    setPhase('analysing');
    const pcm = await adapter.stopRecording();

    // «No hay señal» y «no habló» son cosas distintas y la pantalla debe poder
    // decir cuál: un micrófono ocupado por otra app entrega cero bloques sin
    // dar ningún error.
    const noSignal = !adapter.hasSignal() || pcm.length === 0;
    if (noSignal) setMicHealth(adapter.health?.() ?? 'silent');
    const takeIssues: ProsodyTakeIssues = {
      noSignal,
      clipping: clippingRef.current,
      tooLittleSpeech: speechRef.current < MIN_SPEECH_SEC,
    };

    if (noSignal) {
      if (!mountedRef.current) return;
      setIssues(takeIssues);
      setPhase('error');
      stoppingRef.current = false;
      return;
    }

    const analysed = await adapter.analyse(pcm);
    if (!mountedRef.current) return;
    setResult(analysed);
    setIssues(takeIssues);
    setPhase('done');
    stoppingRef.current = false;
  }, []);

  const start = useCallback(async () => {
    const adapter = getProsodyMicAdapter();
    if (!adapter) {
      setAvailable(false);
      return;
    }
    reset();
    setPhase('recording');

    try {
      await adapter.startRecording(frame => {
        if (!mountedRef.current) return;
        speechRef.current = frame.speechSec;
        if (frame.clipping) clippingRef.current = true;
        setElapsedSec(frame.elapsedSec);
        setSpeechSec(frame.speechSec);
        setLevel(frame.rms);
        if (frame.clipping) setClipping(true);

        // Tope duro: la toma se cierra sola. Se hace aquí y no con un temporizador
        // porque el reloj de la toma es el audio recibido, no el del sistema: si
        // el motor deja de entregar bloques, un `setTimeout` cerraría una toma que
        // en realidad ya estaba muerta, y el motivo real quedaría oculto.
        if (frame.elapsedSec >= MAX_TAKE_SEC) void stop();
      });
    } catch {
      /* El arranque falla (permiso denegado, sin motor de captura). Sin este
       * `catch` la promesa se rechazaba sin dueño y la pantalla se quedaba
       * PARA SIEMPRE en «grabando», con su botón de detener y sin un solo
       * bloque de audio: el clínico esperaba una toma que nunca existió. */
      if (!mountedRef.current) return;
      setMicHealth(adapter.health?.() ?? 'silent');
      setIssues({ ...NO_ISSUES, noSignal: true });
      setPhase('error');
    }
  }, [reset, stop]);

  return {
    phase,
    elapsedSec,
    speechSec,
    level,
    clipping,
    enough: speechSec >= TARGET_SPEECH_SEC,
    result,
    issues,
    available,
    micHealth,
    start,
    stop,
    reset,
  };
}
