import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';

import { interpretAudiometry, pta, severityOf } from '@/Screens/Audiometry/audiometryResult';
import { buildInterpretation as buildVoiceInterpretation } from '@/Screens/VoiceAnalysis/voiceAnalysisResult';
import { efStatus } from '@/Screens/ExecutiveFunctions/executiveFunctionsGame';

/* -------------------------------------------------------------------------- */
/*  Lectura de los resultados de UNA evaluación, en tarjetas resumidas.        */
/*                                                                             */
/*  Vive aparte de la pantalla porque lo consumen dos vistas: los resultados   */
/*  preliminares de la sesión EN CURSO y el historial de pruebas de un         */
/*  paciente (sesiones anteriores). Tenerlo duplicado hacía que ampliar la     */
/*  batería obligara a tocar dos sitios y que las dos vistas divergieran.      */
/* -------------------------------------------------------------------------- */

export type ResultStatus = 'ok' | 'warn' | 'alt';

export interface ResultCard {
  key: string;
  title: string;
  status: ResultStatus;
  headline: string;
  metric: string;
}

/** Recuento por estado, para los contadores de las cabeceras. */
export interface ResultCounts {
  ok: number;
  warn: number;
  alt: number;
  /** Áreas con hallazgos (revisar + alterado). */
  affected: number;
  total: number;
}

export const countResults = (cards: ResultCard[]): ResultCounts => {
  const ok = cards.filter(c => c.status === 'ok').length;
  const warn = cards.filter(c => c.status === 'warn').length;
  const alt = cards.filter(c => c.status === 'alt').length;
  return { ok, warn, alt, affected: warn + alt, total: cards.length };
};

/**
 * Tarjetas de resultado de una evaluación, leyendo cada repositorio de módulo.
 *
 * Cada módulo se lee por separado y un fallo suyo NO tumba la lista: una tabla
 * que aún no existe en una base de datos antigua dejaba la pantalla entera en
 * blanco, que es parte de por qué «las pantallas de resultados no están».
 */
export async function loadEvaluationResultCards(evaluationId: number): Promise<ResultCard[]> {
  const cards: ResultCard[] = [];

  /** Ejecuta la lectura de un módulo aislando su fallo del resto. */
  const collect = async (label: string, read: () => Promise<void>) => {
    try {
      await read();
    } catch (e) {
      console.warn(`VIA+: no se pudieron leer los resultados de ${label}`, e);
    }
  };

  await collect('audiometría', async () => {
    const audiometries = await AudiometryRepository.getAudiometryByEvaluation(evaluationId);
    audiometries.forEach(a => {
      let status: ResultStatus;
      let metric: string;
      if (a.thresholds.CL) {
        // Cribado en campo libre: PTA binaural único.
        const clPta = pta(a.thresholds.CL);
        status = severityOf(clPta)?.key === 'normal' ? 'ok' : 'warn';
        metric = `Campo libre ${clPta ?? '—'} dB HL`;
      } else {
        const odPta = pta(a.thresholds.OD);
        const oiPta = pta(a.thresholds.OI);
        const sevOd = severityOf(odPta);
        const sevOi = severityOf(oiPta);
        status = sevOd?.key !== 'normal' || sevOi?.key !== 'normal' ? 'warn' : 'ok';
        metric = `OD ${odPta ?? '—'} dB HL · OI ${oiPta ?? '—'} dB HL`;
      }
      cards.push({
        key: `audio-${a.id}`,
        title: a.method === 'conditioned' ? 'Audiometría Condicionada' : 'Audiometría Infantil',
        status,
        headline: interpretAudiometry(a.thresholds),
        metric,
      });
    });
  });

  await collect('análisis de voz', async () => {
    const voiceAnalyses = await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluationId);
    voiceAnalyses.forEach(v => {
      // Cierre manual: sin acústica, se muestra la valoración GRBAS registrada.
      if (v.f0 == null || v.jitter == null || v.shimmer == null || v.hnr == null) {
        cards.push({
          key: `voice-${v.id}`,
          title: 'Análisis Acústico de Voz',
          status: v.grbas && v.grbas.g >= 1 ? 'warn' : 'ok',
          headline: v.interpretation || 'Prueba de voz cerrada manualmente (análisis acústico no disponible).',
          metric: v.grbas
            ? `GRBAS G${v.grbas.g} R${v.grbas.r} B${v.grbas.b} A${v.grbas.a} S${v.grbas.s}`
            : 'Cierre manual',
        });
        return;
      }
      const params = { f0: v.f0, jitter: v.jitter, shimmer: v.shimmer, hnr: v.hnr, formants: v.formants };
      const interp = buildVoiceInterpretation(params);
      const altered = interp.startsWith('Se observa');
      cards.push({
        key: `voice-${v.id}`,
        title: 'Análisis Acústico de Voz',
        status: altered ? 'alt' : 'ok',
        headline: interp,
        metric: `F0 ${Math.round(v.f0)} Hz · Jitter ${v.jitter.toFixed(1)}% · Shimmer ${v.shimmer.toFixed(1)}%`,
      });
    });
  });

  await collect('funciones ejecutivas', async () => {
    const efTests = await ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(evaluationId);
    efTests.forEach(ef => {
      const overall = ef.overallScore;
      const st: ResultStatus = overall === null ? 'warn' : efStatus(overall);
      cards.push({
        key: `ef-${ef.id}`,
        title: 'Funciones Ejecutivas',
        status: st,
        headline: ef.interpretation || 'Exploración lúdica de funciones ejecutivas completada.',
        metric: `Índice global ${overall !== null ? `${overall}/100` : '—'} · banda ${ef.ageBand}`,
      });
    });
  });

  await collect('disfagia', async () => {
    const dysphagias = await DysphagiaTestRepository.getDysphagiaByEvaluation(evaluationId);
    dysphagias.forEach(d => {
      const status: ResultStatus = d.verdict === 'safe' ? 'ok' : d.verdict === 'safety' ? 'alt' : 'warn';
      cards.push({
        key: `dys-${d.id}`,
        title: 'Exploración de Disfagia',
        status,
        headline: d.interpretation || 'Exploración MECV-V completada.',
        metric: `SpO₂ basal ${d.basalSpO2}% · mín. ${d.minSpO2 ?? '—'}%`,
      });
    });
  });

  await collect('cribado SAHS', async () => {
    const sahsScreenings = await SahsScreeningRepository.getSahsScreeningsByEvaluation(evaluationId);
    sahsScreenings.forEach(s => {
      const status: ResultStatus = s.suspicionLevel === 'high' ? 'alt' : s.suspicionLevel === 'med' ? 'warn' : 'ok';
      cards.push({
        key: `sahs-${s.id}`,
        title: 'Cribado SAHS Infantil',
        status,
        headline: s.suspicionLabel || s.recommendation,
        metric: `PSQ ${s.psqYesCount}/${s.psqTotal} · Puntuación ${s.totalScore}/${s.scoreMax}`,
      });
    });
  });

  await collect('articulación', async () => {
    const articulations = await ArticulationTestRepository.getArticulationByEvaluation(evaluationId);
    articulations.forEach(a => {
      const status: ResultStatus = a.correctPct >= 90 ? 'ok' : a.correctPct >= 70 ? 'warn' : 'alt';
      cards.push({
        key: `art-${a.id}`,
        title: 'Articulación · T.A.R.',
        status,
        headline: `${a.correctPct}% de producción correcta`,
        metric: `${a.evaluatedCount}/${a.totalCount} ítems · ${a.affectedPhonemes.length} fonema(s) afectado(s)`,
      });
    });
  });

  await collect('cribados', async () => {
    const screenings = await ScreeningRepository.getScreeningsByEvaluation(evaluationId);
    screenings.forEach(s => {
      const status: ResultStatus = s.riskLevel === 'high' ? 'alt' : s.riskLevel === 'med' ? 'warn' : 'ok';
      cards.push({
        key: `screen-${s.id}`,
        title: s.instrument === 'autism-tea' ? 'Cuestionario Autismo' : s.instrument,
        status,
        headline: s.rangeLabel,
        metric: `Puntuación ${s.score}/${s.total}`,
      });
    });
  });

  return cards;
}
