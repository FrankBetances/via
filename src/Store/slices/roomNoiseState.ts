/* -------------------------------------------------------------------------- */
/*  Estado REAL de la verificación acústica de la sala.                        */
/*                                                                             */
/*  POR QUÉ EXISTE ESTE SLICE                                                  */
/*  El hub deducía el estado de la sala de la AUSENCIA de una bandera de       */
/*  navegación (`noiseCheckSkipped`), así:                                     */
/*                                                                             */
/*      {noiseCheckSkipped ? «Sala sin verificar» : «Sala verificada ✓»}       */
/*                                                                             */
/*  Esa bandera solo la pone el botón de SALTAR del sonómetro. Cualquier otro  */
/*  camino la deja `undefined`, y `undefined` caía en la rama del tic verde:   */
/*                                                                             */
/*    · el clínico NUNCA abre el sonómetro          → «Sala verificada ✓»      */
/*    · mide, sale «DEMASIADO RUIDO» y vuelve atrás → «Sala verificada ✓»      */
/*                                                                             */
/*  El segundo caso es el grave: el sonómetro dice que la sala invalida las    */
/*  pruebas auditivas y el hub, acto seguido, muestra un certificado verde.    */
/*  Es exactamente lo que el comentario de `screenTypeNavigator.ts` juraba que */
/*  no pasaba —«el hub sigue mostrando que la sala NO está verificada en vez   */
/*  de anunciar un certificado que nadie emitió»—: el código hacía lo          */
/*  contrario de lo que su propio comentario afirmaba.                         */
/*                                                                             */
/*  La regla que impone este módulo: **«verificada» es un estado que hay que   */
/*  GANARSE con una medición que pasa.** El valor por defecto es               */
/*  `unmeasured`, y ninguna ausencia de dato puede volver a leerse como un     */
/*  aprobado. Un veredicto que no se ha emitido no se presume favorable.       */
/*                                                                             */
/*  NO se persiste (queda fuera de la whitelist de redux-persist): la acústica */
/*  de una sala es de ESTA sesión, en ESTE sitio. Heredarla de ayer sería otra */
/*  forma de afirmar algo que nadie ha comprobado hoy.                         */
/* -------------------------------------------------------------------------- */

/** Estado de la sala. `unmeasured` es el valor por defecto, y significa eso. */
export type RoomNoiseStatus =
  /** Nadie ha medido todavía en esta sesión. */
  | 'unmeasured'
  /** Medido y por debajo del umbral: se puede iniciar la batería. */
  | 'ok'
  /** Medido y cerca del umbral: conviene repetir. */
  | 'warn'
  /** Medido y por encima: invalidaría las pruebas auditivas. */
  | 'block'
  /** El clínico saltó la medición a propósito. */
  | 'skipped';

export interface RoomNoiseState {
  status: RoomNoiseStatus;
  /** Nivel medio medido en dB(A) SPL ORIENTATIVO (micrófono sin calibrar). */
  avgDb: number | null;
  /** Pico sostenido de la medición, misma escala orientativa. */
  peakDb: number | null;
  /** Momento de la medición (epoch ms), para que el informe pueda fecharla. */
  measuredAt: number | null;
}

export const initialRoomNoise: RoomNoiseState = {
  status: 'unmeasured',
  avgDb: null,
  peakDb: null,
  measuredAt: null,
};

/** Registra una medición REAL. Función pura: el slice solo la envuelve. */
export const applyRoomNoiseVerdict = (
  status: Exclude<RoomNoiseStatus, 'unmeasured' | 'skipped'>,
  avgDb: number | null,
  peakDb: number | null,
  now: number = Date.now(),
): RoomNoiseState => ({ status, avgDb, peakDb, measuredAt: now });

/** El clínico saltó la medición: se registra COMO SALTADA, no como apta. */
export const applyRoomNoiseSkip = (now: number = Date.now()): RoomNoiseState => ({
  status: 'skipped',
  avgDb: null,
  peakDb: null,
  measuredAt: now,
});

/**
 * ¿Puede el hub anunciar la sala como verificada? SOLO con una medición propia
 * que haya pasado. Cualquier otro estado —incluido «no se ha medido»— es un no.
 */
export const isRoomVerified = (s: RoomNoiseState): boolean => s.status === 'ok';

/** Etiqueta honesta del estado de la sala, para la cabecera del hub. */
export const roomNoiseLabel = (s: RoomNoiseState): string => {
  switch (s.status) {
    case 'ok':
      return 'Sala verificada · sonómetro OK';
    case 'warn':
      return 'Sala en el límite · repita la medición';
    case 'block':
      return 'Sala DEMASIADO RUIDOSA · pruebas auditivas no válidas';
    case 'skipped':
      return 'Sala sin verificar · sonómetro omitido';
    case 'unmeasured':
    default:
      return 'Sala sin medir · ejecute el sonómetro';
  }
};
