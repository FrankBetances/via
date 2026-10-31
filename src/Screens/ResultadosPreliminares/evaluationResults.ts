import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';

import { getUiLang } from '@/I18n/uiLang';
import {
  evaluateVoiceFacts,
  isNlgCatalogReady,
  nlgMissingDataMessage,
  renderDysphagiaInterpretation,
} from '@/PDF/nlgReportEngine';
import { interpretAudiometry, pta, severityOf } from '@/Screens/Audiometry/audiometryResult';
import { interpretVerbal, verbalDiscriminationStatus } from '@/Screens/VerbalAudiometry/verbalAudiometryResult';
import { prosodyInterpretation } from '@/Screens/ProsodyAnalysis/prosodyResult';
import { interpretExecutiveFunctions, efStatus } from '@/Screens/ExecutiveFunctions/executiveFunctionsGame';

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
  const lang = getUiLang();
  const catalogReady = isNlgCatalogReady(lang);
  const missing = nlgMissingDataMessage(lang);

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
        status: catalogReady ? status : 'warn',
        headline: catalogReady ? interpretAudiometry(a.thresholds) : missing,
        metric,
      });
    });
  });

  await collect('análisis de voz', async () => {
    const voiceAnalyses = await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluationId);
    voiceAnalyses.forEach(v => {
      const facts = catalogReady ? evaluateVoiceFacts({ voiceAnalyses: [v] }, lang) : [];
      const headline = catalogReady ? facts.map(f => f.text).join(' ') : missing;
      const f0 = v.f0;
      const jitter = v.jitter;
      const shimmer = v.shimmer;
      const acoustic = f0 != null && jitter != null && shimmer != null && v.hnr != null;
      cards.push({
        key: `voice-${v.id}`,
        title: 'Análisis Acústico de Voz',
        status: !catalogReady || facts.some(f => f.level === 'warning') ? 'warn' : 'ok',
        headline,
        metric: acoustic
          ? `F0 ${Math.round(f0)} Hz · Jitter ${jitter.toFixed(1)}% · Shimmer ${shimmer.toFixed(1)}%`
          : v.grbas
            ? `GRBAS G${v.grbas.g} R${v.grbas.r} B${v.grbas.b} A${v.grbas.a} S${v.grbas.s}`
            : 'Cierre manual',
      });
    });
  });

  await collect('audiometría verbal', async () => {
    const verbals = await VerbalAudiometryRepository.getVerbalAudiometryByEvaluation(evaluationId);
    verbals.forEach(v => {
      // Sin ítems presentados la prueba quedó a medias: no es «normal».
      const status: ResultStatus = v.presentedCount
        ? verbalDiscriminationStatus(v.discriminationPct)
        : 'warn';
      cards.push({
        key: `verbal-${v.id}`,
        title: 'Audiometría Verbal',
        status: catalogReady ? status : 'warn',
        headline: catalogReady
          ? interpretVerbal(
              v.ageBand,
              {
                levelScores: v.levelScores,
                presentedCount: v.presentedCount,
                correctCount: v.correctCount,
                discriminationPct: v.discriminationPct,
              },
              v.srtDb,
              v.language,
            )
          : missing,
        metric: `Discriminación ${v.discriminationPct} % · ${v.correctCount}/${v.presentedCount} ítems${
          v.srtDb != null ? ` · URV ≈ ${v.srtDb} dB` : ''
        }`,
      });
    });
  });

  await collect('análisis prosódico', async () => {
    const prosodies = await ProsodyAnalysisRepository.getProsodyAnalysisByEvaluation(evaluationId);
    prosodies.forEach(p => {
      // Sin baremo poblacional la prosodia no emite juicio: 'warn' aquí solo
      // marca la toma que no dio métricas, no un hallazgo clínico.
      const m = p.metrics;
      const metric = [
        m.f0RangeSt !== null ? `Rango tonal ${m.f0RangeSt.toFixed(1)} st` : null,
        m.speechRateSps !== null ? `${m.speechRateSps.toFixed(1)} síl/s` : null,
        m.pauseCount !== null ? `${m.pauseCount} pausa(s)` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      cards.push({
        key: `prosody-${p.id}`,
        title: 'Análisis Prosódico',
        status: p.reason === 'ok' ? 'ok' : 'warn',
        headline: p.interpretation || prosodyInterpretation(p.metrics, p.reason),
        metric: metric || 'Sin métricas estimables',
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
        status: catalogReady ? st : 'warn',
        headline: catalogReady
          ? interpretExecutiveFunctions(ef.ageBand, {
              attention: ef.attentionScore,
              inhibition: ef.inhibitionScore,
              flexibility: ef.flexibilityScore,
              workingMemory: ef.workingMemoryScore,
              planning: ef.planningScore,
            })
          : missing,
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
        status: catalogReady ? status : 'warn',
        headline: catalogReady
          ? renderDysphagiaInterpretation(
              {
                verdict: d.verdict,
                minSpO2: d.minSpO2,
                maxDrop: d.maxDrop,
                recommendation: d.recommendation,
              },
              lang,
            )
          : missing,
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
