import type {
  ProsodyMetricsRecord,
  ProsodyTask,
} from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import type { ProsodyResult } from './prosodyDsp';

/* -------------------------------------------------------------------------- */
/*  Puente entre el DSP y la persistencia.                                     */
/*                                                                            */
/*  Aquí se decide QUÉ SALE del análisis hacia la base de datos, y por eso es  */
/*  el punto donde se aplica la garantía Zero-PHI del módulo: `ProsodyResult`  */
/*  trae además los contornos de F0 e intensidad y los instantes de cada       */
/*  núcleo silábico —una serie temporal de la voz del menor, muestreada cada   */
/*  10 ms—, y NADA de eso cruza esta función. Los contornos viven en memoria   */
/*  mientras la pantalla los dibuja y mueren con ella.                        */
/*                                                                            */
/*  Que el mapeo sea explícito campo a campo, en vez de un `...spread`, es     */
/*  deliberado: con propagación, añadir mañana un campo al resultado del DSP   */
/*  lo colaría en la base de datos sin que nadie lo revisara.                  */
/* -------------------------------------------------------------------------- */

/** Métricas del DSP → registro persistible. No copia audio ni contornos. */
export function toProsodyMetricsRecord(result: ProsodyResult): ProsodyMetricsRecord {
  const m = result.metrics;
  return {
    durationSec: m.durationSec,
    spanSec: m.spanSec,
    phonationTimeSec: m.phonationTimeSec,
    voicedFraction: m.voicedFraction,

    pauseCount: m.pauseCount,
    pauseTotalSec: m.pauseTotalSec,
    pauseMeanSec: m.pauseMeanSec,

    syllableCount: m.syllableCount,
    speechRateSps: m.speechRateSps,
    articulationRateSps: m.articulationRateSps,

    f0MedianHz: m.f0MedianHz,
    f0RangeSt: m.f0RangeSt,
    f0SdSt: m.f0SdSt,
    finalContourSt: m.finalContourSt,

    intensitySdDb: m.intensitySdDb,
  };
}

/**
 * ¿Son comparables dos tomas entre sí?
 *
 * B0.2 permite UNA sola comparación: el niño consigo mismo a lo largo del
 * seguimiento. Pero esa comparación solo vale **dentro de la misma tarea**: el
 * habla automática y la repetición son más rápidas que la imitada, y la
 * generación de historia más lenta que la narración espontánea. Comparar la
 * tasa de una narración con la de una lectura mediría el cambio de tarea, no el
 * progreso del niño.
 *
 * La banda de edad no entra en la comparación a propósito: un niño que pasa de
 * prelector a lector durante el seguimiento cambia de banda, y perder por eso
 * el histórico sería absurdo. Lo que no puede cambiar es la tarea.
 */
export const areProsodyTakesComparable = (a: ProsodyTask, b: ProsodyTask): boolean => a === b;

/**
 * ¿Hay alguna métrica publicable en este registro?
 *
 * Distingue «se midió y salió cero» de «no se midió». Una toma sin ninguna
 * métrica se guarda igual —queda constancia de que la prueba se intentó— pero
 * el informe debe presentarla como no concluyente, no como una fila de ceros.
 */
export function hasPublishableMetrics(record: ProsodyMetricsRecord): boolean {
  return (
    record.pauseCount !== null ||
    record.syllableCount !== null ||
    record.f0MedianHz !== null ||
    record.voicedFraction !== null
  );
}
