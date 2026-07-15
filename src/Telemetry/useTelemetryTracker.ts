/* -------------------------------------------------------------------------- */
/*  useTelemetryTracker — hook SILENCIOSO de telemetría.                       */
/*                                                                            */
/*  Contrato de rendimiento (innegociable en gama baja):                      */
/*    · CERO useState → CERO re-render provocado por la telemetría.           */
/*    · La API se materializa UNA sola vez en un `useRef` (identidad estable) */
/*      → segura como dependencia de efectos, no dispara reconciliación.      */
/*                                                                            */
/*  Los métodos delegan en el singleton `telemetryStore` (estado que          */
/*  sobrevive a la navegación entre las pantallas de módulo). El componente    */
/*  contenedor (hub de la batería) solo "inyecta" el hook y llama a           */
/*  `startSession`; cada módulo instrumentado llama a `enterReactivo` /       */
/*  `classifyReactivo`; la pantalla de cierre llama a `setLikert` /           */
/*  `endSession` / `getSnapshot`.                                             */
/* -------------------------------------------------------------------------- */

import { useRef } from 'react';

import {
  classifyReactivo,
  endSession,
  enterReactivo,
  getSnapshot,
  resetTelemetry,
  setLikert,
  startSession,
  type TelemetrySnapshot,
} from './telemetryStore';

export interface TelemetryTracker {
  /** Arranca/reinicia la medición de una batería. Devuelve el sessionId. */
  startSession(batteryId?: string): string;
  /** Marca la activación de un reactivo (clave opaca del módulo). */
  enterReactivo(key: string | number): void;
  /** Marca la clasificación de un reactivo (2ª+ = rectificación). */
  classifyReactivo(key: string | number): void;
  /** Fija la percepción Likert (1–5). */
  setLikert(score: number): void;
  /** Congela la duración total. */
  endSession(): void;
  /** Limpia toda la telemetría. */
  reset(): void;
  /** Snapshot listo para comprimir (`null` si no hay sesión). */
  getSnapshot(): TelemetrySnapshot | null;
}

export function useTelemetryTracker(): TelemetryTracker {
  // Una única materialización: la referencia no cambia entre renders, así que
  // inyectar este objeto no causa re-renders ni invalida deps de efectos.
  const ref = useRef<TelemetryTracker | null>(null);
  if (ref.current === null) {
    ref.current = {
      startSession,
      enterReactivo,
      classifyReactivo,
      setLikert,
      endSession,
      reset: resetTelemetry,
      getSnapshot,
    };
  }
  return ref.current;
}
