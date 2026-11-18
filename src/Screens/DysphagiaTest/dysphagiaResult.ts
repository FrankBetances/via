/**
 * Lógica clínica pura de la disfagia MECV-V, extraída LITERALMENTE de
 * `DysphagiaTestScreen.tsx`.
 *
 * ATENCIÓN: la pantalla AÚN NO USA este módulo. Sigue llevando su copia. El
 * cableado lo hará otra sesión con permiso de Frank (regla 0 bis). Mientras
 * tanto, `__tests__/dysphagiaResult.test.ts` lee el `.tsx` como texto y falla
 * si las cifras de una copia y otra divergen.
 *
 * Origen (DysphagiaTestScreen.tsx):
 *  - BOLUS_LIST ............ líneas 62-70
 *  - MIN_SPO2_DROP ......... línea 73
 *  - BoloState/emptyBolo ... líneas 75-90
 *  - deriveBolo ............ líneas 220-226
 *  - nextBoloId ............ líneas 345-346
 *  - análisis (analyze) .... líneas 411-450 (dentro del useMemo `analysis`)
 *  - verdict ............... líneas 476-480
 *
 * Los textos de recomendación se copian tal cual (líneas 446-448).
 */

export type Viscosity = 'nectar' | 'liquido' | 'pudin';
export type DysphagiaVerdict = 'safe' | 'efficacy' | 'safety';

export interface BolusConfig {
  id: number;
  viscosity: Viscosity;
  volumeVal: number;
  nextSafe: number | null;
  nextUnsafe: number | null;
}

// DysphagiaTestScreen.tsx:62-70 (solo los campos que usa la lógica; sin textos de UI)
export const BOLUS_LIST: BolusConfig[] = [
  { id: 1, viscosity: 'nectar', volumeVal: 5, nextSafe: 2, nextUnsafe: 7 },
  { id: 2, viscosity: 'nectar', volumeVal: 10, nextSafe: 3, nextUnsafe: 7 },
  { id: 3, viscosity: 'nectar', volumeVal: 20, nextSafe: 4, nextUnsafe: 7 },
  { id: 4, viscosity: 'liquido', volumeVal: 5, nextSafe: 5, nextUnsafe: 7 },
  { id: 5, viscosity: 'liquido', volumeVal: 10, nextSafe: 6, nextUnsafe: 7 },
  { id: 6, viscosity: 'liquido', volumeVal: 20, nextSafe: 7, nextUnsafe: 7 },
  { id: 7, viscosity: 'pudin', volumeVal: 5, nextSafe: 8, nextUnsafe: null },
  { id: 8, viscosity: 'pudin', volumeVal: 10, nextSafe: 9, nextUnsafe: null },
  { id: 9, viscosity: 'pudin', volumeVal: 20, nextSafe: null, nextUnsafe: null },
];

// DysphagiaTestScreen.tsx:73. Caída de SpO2 (puntos) respecto a la basal que cuenta como desaturación.
export const MIN_SPO2_DROP = 3;

// DysphagiaTestScreen.tsx:75-81
export interface BoloState {
  evaluated: boolean;
  skipped: boolean;
  spo2: number | null;
  safety: { tos: boolean; cambio_voz: boolean };
  efficacy: { sello_labial: boolean; residuo: boolean; deglucion_fraccionada: boolean };
}

// DysphagiaTestScreen.tsx:83-89
export const emptyBoloState = (): BoloState => ({
  evaluated: false,
  skipped: false,
  spo2: null,
  safety: { tos: false, cambio_voz: false },
  efficacy: { sello_labial: false, residuo: false, deglucion_fraccionada: false },
});

// DysphagiaTestScreen.tsx:220-226 (literal)
export function deriveBolo(s: BoloState, basalSpO2: number) {
  const eff = s.spo2 == null ? basalSpO2 : s.spo2;
  const desat = basalSpO2 - eff >= MIN_SPO2_DROP;
  const hasSafety = s.safety.tos || s.safety.cambio_voz || desat;
  const hasEfficacy = s.efficacy.sello_labial || s.efficacy.residuo || s.efficacy.deglucion_fraccionada;
  return { eff, desat, hasSafety, hasEfficacy };
}

// DysphagiaTestScreen.tsx:345-346: a qué bolo se salta tras evaluar el actual.
export function nextBoloId(cfg: BolusConfig, state: BoloState, basalSpO2: number): number | null {
  const isUnsafe = deriveBolo(state, basalSpO2).hasSafety;
  return isUnsafe ? cfg.nextUnsafe : cfg.nextSafe;
}

// DysphagiaTestScreen.tsx:411-450 (cuerpo del useMemo `analysis`, literal salvo el parámetro)
export function analyzeDysphagia(boloStates: Record<number, BoloState>, basalSpO2: number) {
  let hasSafetyAlt = false;
  let hasEfficacyAlt = false;
  let minSpO2 = basalSpO2;
  let maxDrop = 0;
  let nSafe = 0,
    lSafe = 0,
    pSafe = 0;
  let nBad = false,
    lBad = false,
    pBad = false;

  for (let i = 1; i <= 9; i++) {
    const s = boloStates[i];
    if (!s.evaluated) continue;
    const cfg = BOLUS_LIST[i - 1];
    const d = deriveBolo(s, basalSpO2);
    if (d.hasSafety) hasSafetyAlt = true;
    if (d.hasEfficacy) hasEfficacyAlt = true;
    minSpO2 = Math.min(minSpO2, d.eff);
    maxDrop = Math.max(maxDrop, basalSpO2 - d.eff);
    const safe = !d.hasSafety;
    if (cfg.viscosity === 'nectar') {
      if (!safe) nBad = true;
      else if (!nBad) nSafe = Math.max(nSafe, cfg.volumeVal);
    } else if (cfg.viscosity === 'liquido') {
      if (!safe) lBad = true;
      else if (!lBad) lSafe = Math.max(lSafe, cfg.volumeVal);
    } else {
      if (!safe) pBad = true;
      else if (!pBad) pSafe = Math.max(pSafe, cfg.volumeVal);
    }
  }

  let recom = 'Suspender vía oral (nutrición alternativa)';
  if (lSafe >= 5 && !lBad && !nBad) recom = `Líquido ${lSafe} mL`;
  else if (nSafe >= 5 && !nBad) recom = `Néctar ${nSafe} mL`;
  else if (pSafe >= 5 && !pBad) recom = `Pudin ${pSafe} mL`;

  return { hasSafetyAlt, hasEfficacyAlt, minSpO2, maxDrop, recom };
}

// DysphagiaTestScreen.tsx:476-480 (literal)
export function dysphagiaVerdict(analysis: { hasSafetyAlt: boolean; hasEfficacyAlt: boolean }): DysphagiaVerdict {
  return analysis.hasSafetyAlt ? 'safety' : analysis.hasEfficacyAlt ? 'efficacy' : 'safe';
}
