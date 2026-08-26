/* -------------------------------------------------------------------------- */
/*  Motor de Apoyo a la Decisión Clínica (CDSS) para Cribado ASHA.            */
/*  IEC 62304 Clase B / MDR 2017/745 / ISO 14971.                             */
/*  Lógica PURA, determinista, offline y sin efectos secundarios.             */
/* -------------------------------------------------------------------------- */

import { AshaDomain, AshaMilestone } from './ashaMilestones';
import { AshaRiskLevel } from '@/Models/Asha/AshaMilestoneTest';

export interface AshaDomainSummary {
  domain: AshaDomain;
  total: number;
  achieved: number;
  failed: number;
  failedItems: AshaMilestone[];
  isCompromised: boolean;
}

export interface AshaCdssResult {
  ageBand: string;
  totalEvaluated: number;
  achievedCount: number;
  failedCount: number;
  riskLevel: AshaRiskLevel;
  riskLabel: string;
  riskColor: string;
  failedDomains: AshaDomain[];
  domainBreakdown: Record<AshaDomain, AshaDomainSummary>;
  redFlagsDetected: AshaMilestone[];
  recommendedReferrals: string[];
  clinicalSummary: string;
  suggestedAction: string;
}

export const ASHA_RISK_LABELS: Record<AshaRiskLevel, string> = {
  green: 'Normotípico (Bajo Riesgo)',
  yellow: 'Riesgo Moderado / Retraso Leve',
  red: 'Riesgo Alto / Signos de Alerta (Banderas Rojas)',
};

export const ASHA_RISK_COLORS: Record<AshaRiskLevel, string> = {
  green: '#2A7948',
  yellow: '#FF7F00',
  red: '#DC2626',
};

/**
 * Evalúa las respuestas del clínico frente al catálogo de hitos ASHA aplicando
 * reglas clínicas deterministas de decisión basadas en percentil 75.
 *
 * @param responses Mapa de id de hito a booleano (true = cumplido, false = no cumplido).
 * @param milestones Lista de hitos correspondientes a la banda de edad analizada.
 * @returns Resultado estructurado CDSS con nivel de riesgo y rutas de derivación.
 */
export function evaluateAshaScreening(
  responses: Record<string, boolean | null | undefined>,
  milestones: AshaMilestone[],
): AshaCdssResult {
  const ageBand = milestones[0]?.ageBand ?? 'desconocida';
  let achievedCount = 0;
  let failedCount = 0;
  const failedMilestones: AshaMilestone[] = [];
  const redFlagsDetected: AshaMilestone[] = [];

  const domainMap: Record<AshaDomain, AshaDomainSummary> = {
    receptive: { domain: 'receptive', total: 0, achieved: 0, failed: 0, failedItems: [], isCompromised: false },
    expressive: { domain: 'expressive', total: 0, achieved: 0, failed: 0, failedItems: [], isCompromised: false },
    pragmatic: { domain: 'pragmatic', total: 0, achieved: 0, failed: 0, failedItems: [], isCompromised: false },
  };

  for (const m of milestones) {
    const val = responses[m.id];
    domainMap[m.domain].total += 1;

    if (val === true) {
      achievedCount += 1;
      domainMap[m.domain].achieved += 1;
    } else if (val === false) {
      failedCount += 1;
      failedMilestones.push(m);
      domainMap[m.domain].failed += 1;
      domainMap[m.domain].failedItems.push(m);
      domainMap[m.domain].isCompromised = true;

      if (m.isRedFlag) {
        redFlagsDetected.push(m);
      }
    }
  }

  const failedDomains = (Object.keys(domainMap) as AshaDomain[]).filter(
    d => domainMap[d].isCompromised,
  );

  // Regla 1: Nivel de Riesgo
  let riskLevel: AshaRiskLevel = 'green';
  if (redFlagsDetected.length > 0) {
    riskLevel = 'red';
  } else if (failedCount > 0) {
    riskLevel = 'yellow';
  } else {
    riskLevel = 'green';
  }

  // Regla 2: Rutas de derivación clínica basadas en dominios comprometidos
  const referrals: string[] = [];

  const hasReceptive = domainMap.receptive.isCompromised;
  const hasExpressive = domainMap.expressive.isCompromised;
  const hasPragmatic = domainMap.pragmatic.isCompromised;

  if (hasReceptive && hasExpressive) {
    referrals.push('Derivación a ORL (descartar hipoacusia) y Neuropediatría');
  }

  if (hasPragmatic) {
    referrals.push('Derivación a Atención Temprana o Psicología Infantil');
  }

  if (hasExpressive && !hasReceptive && !hasPragmatic) {
    referrals.push('Derivación a Logopedia clínica (evaluación morfosintáctica)');
  }

  if (riskLevel === 'yellow' && referrals.length === 0) {
    referrals.push('Watchful Waiting: pautas de modificación del entorno y revisión en 3 meses');
  }

  if (riskLevel === 'green') {
    referrals.push('Pautas generales de estimulación (lectura dialógica)');
  }

  // Resumen e interpretación clínica para informe
  let clinicalSummary = '';
  let suggestedAction = '';

  if (riskLevel === 'red') {
    clinicalSummary = `Se han identificado ${redFlagsDetected.length} señal(es) de alerta crítica (Banderas Rojas) para la banda de edad ${ageBand}. Dominios comprometidos: ${failedDomains.map(d => domainMap[d].domain).join(', ')}.`;
    suggestedAction = 'Intervención clínica prioritaria. Proceder con derivación interdisciplinar según las especialidades indicadas.';
  } else if (riskLevel === 'yellow') {
    clinicalSummary = `No se observan banderas rojas críticas, pero se detecta retraso evolutivo en ${failedCount} hito(s) del percentil 75 en los dominios: ${failedDomains.join(', ')}.`;
    suggestedAction = 'Monitoreo activo (Watchful Waiting) y pautas de estimulación fonoaudiológica con reevaluación a los 3 meses.';
  } else {
    clinicalSummary = `Desarrollo normotípico del lenguaje y la comunicación para la banda de edad ${ageBand} (${achievedCount}/${milestones.length} hitos alcanzados en percentil 75).`;
    suggestedAction = 'Mantener pautas generales de interacción comunicativa enriquecida y lectura dialógica en el hogar y aula.';
  }

  return {
    ageBand,
    totalEvaluated: achievedCount + failedCount,
    achievedCount,
    failedCount,
    riskLevel,
    riskLabel: ASHA_RISK_LABELS[riskLevel],
    riskColor: ASHA_RISK_COLORS[riskLevel],
    failedDomains,
    domainBreakdown: domainMap,
    redFlagsDetected,
    recommendedReferrals: referrals,
    clinicalSummary,
    suggestedAction,
  };
}
