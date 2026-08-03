import type { ProsodyMetricsRecord } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import type { ProsodyReason } from './prosodyDsp';

/* -------------------------------------------------------------------------- */
/*  Presentación de resultados prosódicos.                                     */
/*                                                                            */
/*  ESTE MÓDULO NO INTERPRETA CLÍNICAMENTE, y no es una carencia: es la        */
/*  decisión B0.2 (`docs/design/b0-prosodia-tarea-y-afirmaciones.md`).         */
/*                                                                            */
/*  No hay baremos pediátricos españoles de prosodia. Los que existen —inglés, */
/*  neerlandés, turco, húngaro, alemán— no son trasladables ni por lengua ni   */
/*  por tarea: la tasa de habla depende fuertemente de qué se pide, y la       */
/*  variabilidad entre niños típicos es sustancial. Poner aquí un umbral de    */
/*  «normal / alterado» sería inventar una precisión clínica que nadie ha      */
/*  medido, que es exactamente lo que este proyecto no hace.                   */
/*                                                                            */
/*  Así que se formatea, se ordena y se explica lo medido. La lectura la firma */
/*  el logopeda.                                                              */
/* -------------------------------------------------------------------------- */

/** Fila del informe: una métrica con su unidad y su explicación. */
export interface ProsodyReportRow {
  key: keyof ProsodyMetricsRecord;
  label: string;
  /** Valor formateado, o `null` si no se midió. */
  value: string | null;
  unit: string;
  /** Qué significa, en una línea, para quien lee el informe. */
  hint: string;
}

const fmt = (v: number | null, digits: number): string | null =>
  v === null || Number.isNaN(v) ? null : v.toFixed(digits);

/**
 * Filas del informe, EN ORDEN DE PESO CLÍNICO: primero tono, después ritmo.
 *
 * No es un orden estético. Un metaanálisis sobre prosodia natural encuentra
 * tamaños de efecto de moderados a grandes en los parámetros de tono (rango,
 * desviación típica, variabilidad) y poco fiables en los temporales (duración,
 * tasa de habla). Presentar la tasa primero daría prioridad visual a la medida
 * que menos discrimina —y que además es la más frágil de estimar—.
 */
export function prosodyReportRows(m: ProsodyMetricsRecord): ProsodyReportRow[] {
  return [
    {
      key: 'f0RangeSt',
      label: 'Rango tonal',
      value: fmt(m.f0RangeSt, 1),
      unit: 'st',
      hint: 'Recorrido de la entonación entre los percentiles 5 y 95. En semitonos, comparable entre edades.',
    },
    {
      key: 'f0SdSt',
      label: 'Variabilidad tonal',
      value: fmt(m.f0SdSt, 1),
      unit: 'st',
      hint: 'Dispersión de la entonación. Un valor bajo acompaña al habla monótona.',
    },
    {
      key: 'finalContourSt',
      label: 'Contorno de cierre',
      value: fmt(m.finalContourSt, 1),
      unit: 'st',
      hint: 'Cambio de tono al final del enunciado. Positivo = ascenso; negativo = descenso.',
    },
    {
      key: 'f0MedianHz',
      label: 'Tono medio',
      value: fmt(m.f0MedianHz, 0),
      unit: 'Hz',
      hint: 'Mediana de la frecuencia fundamental de la muestra.',
    },
    {
      key: 'pauseCount',
      label: 'Pausas',
      value: m.pauseCount === null ? null : String(m.pauseCount),
      unit: '',
      hint: 'Silencios de más de 250 ms dentro del habla. Las oclusiones de las consonantes no cuentan.',
    },
    {
      key: 'pauseTotalSec',
      label: 'Tiempo en pausa',
      value: fmt(m.pauseTotalSec, 2),
      unit: 's',
      hint: 'Suma de las pausas interiores. El silencio previo y posterior no se cuenta.',
    },
    {
      key: 'voicedFraction',
      label: 'Fracción sonora',
      value: m.voicedFraction === null ? null : (m.voicedFraction * 100).toFixed(0),
      unit: '%',
      hint: 'Proporción de la muestra con vibración de las cuerdas vocales.',
    },
    {
      key: 'articulationRateSps',
      label: 'Tasa de articulación',
      value: fmt(m.articulationRateSps, 2),
      unit: 'síl/s',
      hint: 'Sílabas por segundo descontando las pausas. Es la medida más frágil del módulo: interprétese con cautela.',
    },
    {
      key: 'speechRateSps',
      label: 'Tasa de habla',
      value: fmt(m.speechRateSps, 2),
      unit: 'síl/s',
      hint: 'Sílabas por segundo incluyendo las pausas.',
    },
  ];
}

/** Explicación de por qué una toma no dio métricas. */
export function prosodyReasonLabel(reason: ProsodyReason): string {
  switch (reason) {
    case 'ok':
      return 'Análisis completado.';
    case 'empty':
      return 'No se registró audio.';
    case 'silent':
      return 'La toma no contiene habla por encima del ruido de fondo.';
    case 'too-short':
      return 'La toma es más corta que la ventana mínima de análisis.';
    case 'no-voicing':
      return 'Hay sonido, pero ninguna parte es voz con vibración periódica.';
    default:
      return 'Análisis no disponible.';
  }
}

/**
 * Texto de constancia que acompaña al registro. Describe la toma; **no** emite
 * juicio clínico, por lo dicho en la cabecera de este módulo.
 */
export function prosodyInterpretation(
  m: ProsodyMetricsRecord,
  reason: ProsodyReason,
): string {
  if (reason !== 'ok') return prosodyReasonLabel(reason);

  const partes: string[] = [];
  if (m.spanSec !== null) partes.push(`muestra de ${m.spanSec.toFixed(1)} s`);
  if (m.syllableCount !== null) partes.push(`${m.syllableCount} núcleos silábicos`);
  if (m.pauseCount !== null) partes.push(`${m.pauseCount} pausa(s)`);
  if (m.f0RangeSt !== null) partes.push(`rango tonal ${m.f0RangeSt.toFixed(1)} st`);

  const cuerpo = partes.length ? partes.join(', ') : 'sin métricas estimables';
  return (
    `Registro descriptivo: ${cuerpo}. ` +
    'Valores sin baremo poblacional: la lectura clínica corresponde al profesional.'
  );
}
