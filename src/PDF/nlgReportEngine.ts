import { CATALOGUES } from '@/I18n/catalog';
import type { UiStrings } from '@/I18n/catalog';
import { getUiLang } from '@/I18n/uiLang';
import type { UiLang } from '@/I18n/uiLang';
import type { ClinicalAssessment, ClinicalDomains } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import type { AudiometryTest, AudiometryThresholds } from '@/Models/Audiometry/AudiometryTest';
import type { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import type { GrbasScores, VoiceAnalysis, VoiceFormants } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import type { ProsodyAnalysis, ProsodyMetricsRecord } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import type { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import type { AshaMilestoneTest } from '@/Models/Asha/AshaMilestoneTest';
import type { Screening } from '@/Models/Screening/Screening';
import type { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import type { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import type { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';

/* -------------------------------------------------------------------------- */
/*  Motor NLG determinista. Oleada 2.                                          */
/*                                                                            */
/*  Lee entidades ya guardadas y rellena las plantillas de `nlg.rules`. No    */
/*  calcula un veredicto nuevo: si el dato no está, no entra en la frase de   */
/*  intervalo cumplido.                                                       */
/*                                                                            */
/*  No importa los intérpretes de pantalla (`audiometryResult`,               */
/*  `verbalAudiometryResult`, `voiceAnalysisResult`, `executiveFunctionsGame`) */
/*  porque la oleada 3 los hará importar este fichero. Las cifras de abajo    */
/*  son las del plan del motor, no VOICE_NORMS ni severityOf.                 */
/*                                                                            */
/*  No importa `prosodyDsp`: la prosodia entra por la entidad ya persistida.  */
/*  Tampoco importa React, pantallas ni el PDF.                               */
/*                                                                            */
/*  Bolos de MECV-V vacíos: no hay ruleId para «exploración incompleta». No   */
/*  se emite R-DYS-001 (diría que no hubo compromiso) ni se inventa frase.    */
/* -------------------------------------------------------------------------- */

const FREQS = [500, 1000, 2000, 4000] as const;
const F0_LO = 220;
const F0_HI = 320;
const JITTER_MAX = 1.04;
const SHIMMER_MAX = 3.81;
const HNR_MIN = 12;
const PTA_REF_MAX = 20;
const DISC_MIN = 80;
const CONV_LEVEL = 65;
const SRT_MARGIN = 15;
const ACUTE_DB = 25;
const MORPH_DB = 15;
const EF_DOMAIN_CUT = 65;
const EF_OVERALL_CROSS = 70;
const MCHAT_FOLLOW = 3;
const MCHAT_REFER = 8;

const EF_FIELDS = [
  ['attention', 'attentionScore'],
  ['inhibition', 'inhibitionScore'],
  ['flexibility', 'flexibilityScore'],
  ['workingMemory', 'workingMemoryScore'],
  ['planning', 'planningScore'],
] as const;

export type RuleCategory =
  | 'cap'
  | 'cross'
  | 'audiometry'
  | 'verbal'
  | 'voice'
  | 'prosody'
  | 'articulation'
  | 'asha'
  | 'autism'
  | 'dysphagia'
  | 'sahs'
  | 'executive';

export type FindingLevel = 'info' | 'warning';

export interface ClinicalFact {
  ruleId: string;
  category: RuleCategory;
  level: FindingLevel;
  module: string;
  measured: Record<string, string | number | boolean | null>;
  evidenceRef: string;
  text: string;
}

export interface SessionEntities {
  clinicalAssessments?: ClinicalAssessment[];
  audiometries?: AudiometryTest[];
  verbalAudiometries?: VerbalAudiometryTest[];
  voiceAnalyses?: VoiceAnalysis[];
  prosodyAnalyses?: ProsodyAnalysis[];
  articulations?: ArticulationTest[];
  ashaTests?: AshaMilestoneTest[];
  screenings?: Screening[];
  dysphagias?: DysphagiaTest[];
  sahsScreenings?: SahsScreening[];
  executiveFunctions?: ExecutiveFunctionsTest[];
}

export interface NlgReportSynthesis {
  lang: UiLang;
  facts: ClinicalFact[];
  ruleIds: string[];
  crossModuleFindings: ClinicalFact[];
  formattedReportText: string;
  /**
   * `catalog-missing` cuando esa lengua no tiene bloque `nlg` (hoy gl, eu, ca
   * y en: el plan no trae sus frases). El texto es el aviso, no un informe
   * vacío. `null` cuando el catálogo sí tiene el bloque.
   */
  unavailableReason: null | 'catalog-missing';
}

/**
 * Lengua cuyo catálogo no trae `nlg`. No es un hallazgo clínico: el motor se
 * niega a narrar y deja este error, con el código de lengua, para que la
 * pantalla y el PDF lo muestren. Sustituye el `Cannot read properties of
 * undefined` que salía al leer `CATALOGUES[lang].nlg` en gl, eu, ca y en.
 */
export class NlgCatalogMissing extends Error {
  readonly lang: UiLang;

  constructor(lang: UiLang) {
    super(`nlg catalog missing: ${lang}`);
    this.name = 'NlgCatalogMissing';
    this.lang = lang;
  }
}

type NlgPack = UiStrings['nlg'];
type EarSide = 'OD' | 'OI' | 'CL';
type EarMap = Record<number, number | null>;

interface CapRow {
  id: number;
  instrument: string;
  globalResult: string;
  domains: ClinicalDomains | null;
}

interface AudRow {
  id: number;
  transducer: string;
  thresholds: AudiometryThresholds;
  ptaOD: number | null;
  ptaOI: number | null;
}

interface VerRow {
  id: number;
  ageBand: string;
  language: string;
  presentedCount: number;
  correctCount: number;
  levelScores: { level: number; presented: number; correct: number; pct: number }[];
  srtDb: number | null;
}

interface VoiceRow {
  id: number;
  f0: number | null;
  jitter: number | null;
  shimmer: number | null;
  hnr: number | null;
  formants: VoiceFormants | null;
  grbas: GrbasScores | null;
}

interface ProRow {
  id: number;
  reason: string;
  metrics: Partial<ProsodyMetricsRecord> | null;
}

interface ArtRow {
  id: number;
  evaluatedCount: number;
  totalCount: number;
  correctPct: number;
  sodaCounts: Partial<Record<'S' | 'O' | 'D' | 'A', number>> | null;
  affectedPhonemes: { phoneme: string }[];
  phonemeStatus: { phoneme: string; place: string }[];
}

interface AshaRow {
  id: string;
  ageBand: string;
  riskLevel: string;
  failedDomains: string[];
}

interface AutRow {
  id: number;
  instrument: string;
  score: number;
  total: number;
  answers: Record<number, boolean | null> | null;
}

interface DysRow {
  id: number;
  safetyAltered: boolean;
  efficacyAltered: boolean;
  minSpO2: number | null;
  maxDrop: number | null;
  recommendation: string;
  bolus: readonly unknown[] | null;
}

interface SahsRow {
  id: number;
  psqYesCount: number;
  psqTotal: number;
  brodsky: number | null;
  imc: string | null;
  suspicionLevel: string;
}

interface EfRow {
  id: number;
  ageBand: string;
  attentionScore: number | null;
  inhibitionScore: number | null;
  flexibilityScore: number | null;
  workingMemoryScore: number | null;
  planningScore: number | null;
  overallScore: number | null;
}

interface SideView {
  side: EarSide;
  ear: EarMap | undefined;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const listOf = <T>(value: readonly T[] | null | undefined): readonly T[] =>
  Array.isArray(value) ? value : [];

const byNumericId = <T extends { id: number }>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => a.id - b.id);

const byTextId = <T extends { id: string }>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

/**
 * El tipo `UiStrings` exige `nlg`, pero gl, eu, ca y en todavía no lo tienen:
 * el plan no trae esas frases y no se inventan. En ejecución el objeto no
 * trae la clave. Hay que mirarlo antes de leer `.rules`.
 */
const catalogPack = (lang: UiLang): NlgPack | null => {
  const entry = CATALOGUES[lang] as { nlg?: NlgPack } | undefined;
  const pack = entry?.nlg;
  if (!pack || !pack.rules || !pack.sections || !pack.ui || !pack.audit) return null;
  return pack;
};

/** El bloque existe y se puede narrar en esa lengua. */
export const isNlgCatalogReady = (lang: UiLang): boolean => catalogPack(lang) !== null;

/**
 * Aviso cuando no hay síntesis. Si la lengua tiene bloque, es
 * `nlg.ui.missingData`. Si no lo tiene, la misma frase del castellano más el
 * código de lengua: no es una traducción clínica, es la marca de que el
 * bloque falta. Sin esto, gl/eu/ca/en petaban al leer `nlg`.
 */
export const nlgMissingDataMessage = (lang: UiLang): string => {
  const own = catalogPack(lang);
  if (own) return own.ui.missingData;
  const fallback = catalogPack('es')?.ui.missingData ?? 'NLG catalog missing';
  return `${fallback} (${lang})`;
};

const nlg = (lang: UiLang): NlgPack => {
  const pack = catalogPack(lang);
  if (!pack) throw new NlgCatalogMissing(lang);
  return pack;
};

const makeFact = (
  ruleId: string,
  category: RuleCategory,
  level: FindingLevel,
  text: string,
  measured: Record<string, string | number | boolean | null>,
  version: string,
): ClinicalFact => ({
  ruleId,
  category,
  level,
  module: category,
  measured,
  evidenceRef: `${ruleId}@${version}`,
  text,
});

const joinText = (facts: ClinicalFact[]): string => facts.map(f => f.text).join(' ');

const slotNum = (v: number | null | undefined, unavail: string): string | number =>
  isNum(v) ? v : unavail;

const textOrUnavail = (value: string | null | undefined, unavail: string): string => {
  if (typeof value !== 'string') return unavail;
  const trimmed = value.trim();
  return trimmed ? trimmed : unavail;
};

const hasCl = (thresholds: AudiometryThresholds | undefined): boolean =>
  !!thresholds && Object.prototype.hasOwnProperty.call(thresholds, 'CL');

const earOf = (thresholds: AudiometryThresholds | undefined, side: EarSide): EarMap | undefined => {
  if (!thresholds) return undefined;
  if (side === 'CL') {
    if (!hasCl(thresholds)) return undefined;
    return thresholds.CL ?? {};
  }
  return thresholds[side];
};

const freqValue = (ear: EarMap | undefined, hz: number): number | null => {
  if (!ear) return null;
  const v = ear[hz];
  return isNum(v) ? v : null;
};

const determinedFreqs = (ear: EarMap | undefined): number[] => {
  const out: number[] = [];
  for (const hz of FREQS) {
    if (freqValue(ear, hz) !== null) out.push(hz);
  }
  return out;
};

const missingFreqs = (ear: EarMap | undefined): number[] => {
  const out: number[] = [];
  for (const hz of FREQS) {
    if (freqValue(ear, hz) === null) out.push(hz);
  }
  return out;
};

const ptaOf = (ear: EarMap | undefined): number | null => {
  const vals: number[] = [];
  for (const hz of FREQS) {
    const v = freqValue(ear, hz);
    if (v !== null) vals.push(v);
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

const sidePta = (stored: number | null, ear: EarMap | undefined): number | null => {
  if (isNum(stored)) return stored;
  return ptaOf(ear);
};

/**
 * Campo libre guarda OD y OI vacíos porque `emptySoundfieldThresholds` parte
 * del mapa aéreo. Esos dos canales no se midieron. Tratarlos como oído sin
 * respuesta dispararía una derivación en toda audiometría condicionada.
 * Con `transducer === 'soundfield'` solo entra un oído que tenga algún umbral
 * determinado; CL, si la clave existe, entra siempre.
 */
const sidesOf = (row: AudRow): SideView[] => {
  const sides: SideView[] = [
    { side: 'OD', ear: earOf(row.thresholds, 'OD') },
    { side: 'OI', ear: earOf(row.thresholds, 'OI') },
  ];
  if (hasCl(row.thresholds)) sides.push({ side: 'CL', ear: earOf(row.thresholds, 'CL') });
  if (row.transducer !== 'soundfield') return sides;
  return sides.filter(s => s.side === 'CL' || determinedFreqs(s.ear).length > 0);
};

const earLabel = (side: EarSide, rules: NlgPack['rules']): string => {
  if (side === 'OD') return rules.labelEarOd;
  if (side === 'OI') return rules.labelEarOi;
  return rules.labelEarCl;
};

const ptaBand = (pta: number, rules: NlgPack['rules']): string => {
  if (pta <= 20) return rules.labelBandRef;
  if (pta <= 40) return rules.labelBand21;
  if (pta <= 70) return rules.labelBand41;
  if (pta <= 90) return rules.labelBand71;
  return rules.labelBand90;
};

const morphLabel = (ear: EarMap | undefined, rules: NlgPack['rules']): string => {
  const lo = freqValue(ear, 500);
  const hi = freqValue(ear, 4000);
  if (lo === null || hi === null) return rules.labelMorphUnknown;
  const d = hi - lo;
  if (d >= MORPH_DB) return rules.labelMorphDesc;
  if (d <= -MORPH_DB) return rules.labelMorphAsc;
  return rules.labelMorphFlat;
};

const displayedPta = (row: AudRow, side: EarSide, ear: EarMap | undefined): number | null => {
  if (!determinedFreqs(ear).length) return null;
  if (side === 'OD') return sidePta(row.ptaOD, ear);
  if (side === 'OI') return sidePta(row.ptaOI, ear);
  return ptaOf(ear);
};

const needsReferral = (ear: EarMap | undefined): boolean => {
  if (!determinedFreqs(ear).length) return true;
  if (missingFreqs(ear).length > 0) return true;
  for (const hz of FREQS) {
    const v = freqValue(ear, hz);
    if (v !== null && v > PTA_REF_MAX) return true;
  }
  return false;
};

const bestPta = (row: AudRow): number | null => {
  const vals = [
    sidePta(row.ptaOD, earOf(row.thresholds, 'OD')),
    sidePta(row.ptaOI, earOf(row.thresholds, 'OI')),
    ptaOf(earOf(row.thresholds, 'CL')),
  ].filter(isNum);
  if (!vals.length) return null;
  return Math.min(...vals);
};

const f0Outside = (v: number): boolean => v < F0_LO || v > F0_HI;
const jitterOutside = (v: number): boolean => v > JITTER_MAX;
const shimmerOutside = (v: number): boolean => v > SHIMMER_MAX;
const hnrOutside = (v: number): boolean => v < HNR_MIN;

const acousticsAbsent = (row: VoiceRow): boolean =>
  !isNum(row.f0) && !isNum(row.jitter) && !isNum(row.shimmer) && !isNum(row.hnr);

const laryngealOutside = (row: VoiceRow): boolean => {
  if (isNum(row.jitter) && jitterOutside(row.jitter)) return true;
  if (isNum(row.shimmer) && shimmerOutside(row.shimmer)) return true;
  if (isNum(row.hnr) && hnrOutside(row.hnr)) return true;
  return false;
};

const grbasText = (g: GrbasScores | null, rules: NlgPack['rules']): string => {
  if (!g || !isNum(g.g)) return rules.labelGrbasMissing;
  return rules.grbasGrade(g.g);
};

const formantText = (f: VoiceFormants | null, sep: string, unavail: string): string => {
  if (!f || !isNum(f.f1) || !isNum(f.f2) || !isNum(f.f3)) return unavail;
  return [f.f1, f.f2, f.f3].join(sep);
};

const normPhon = (value: string): string => value.trim().toLowerCase().replace(/\//g, '');

const FRICATIVES = new Set(['s', 'f', 'z']);

const fricativesOf = (row: ArtRow): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of row.affectedPhonemes ?? []) {
    const key = normPhon(item.phoneme ?? '');
    if (!FRICATIVES.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(item.phoneme);
  }
  return out;
};

const highFreqLabels = (row: AudRow, rules: NlgPack['rules']): string[] => {
  const out: string[] = [];
  const sides: SideView[] = [
    { side: 'OD', ear: earOf(row.thresholds, 'OD') },
    { side: 'OI', ear: earOf(row.thresholds, 'OI') },
  ];
  if (hasCl(row.thresholds)) sides.push({ side: 'CL', ear: earOf(row.thresholds, 'CL') });
  for (const s of sides) {
    for (const hz of [2000, 4000]) {
      const v = freqValue(s.ear, hz);
      if (v !== null && v > ACUTE_DB) out.push(`${earLabel(s.side, rules)} ${hz} Hz`);
    }
  }
  return out;
};

const ashaDomainLabel = (code: string, rules: NlgPack['rules']): string => {
  if (code === 'receptive') return rules.labelAshaReceptive;
  if (code === 'expressive') return rules.labelAshaExpressive;
  if (code === 'pragmatic') return rules.labelAshaPragmatic;
  return code;
};

const domainList = (codes: readonly string[], rules: NlgPack['rules'], sep: string): string => {
  if (!codes.length) return rules.labelUnavailable;
  return codes.map(code => ashaDomainLabel(code, rules)).join(sep);
};

const ashaTriggersCross = (row: AshaRow): boolean => {
  if (row.riskLevel === 'red') return true;
  const domains = row.failedDomains ?? [];
  return domains.includes('receptive') || domains.includes('pragmatic');
};

const mchatComplete = (row: AutRow): boolean => {
  if (!row.answers || typeof row.answers !== 'object') return false;
  const vals = Object.values(row.answers);
  if (vals.some(v => v === null)) return false;
  const answered = vals.filter(v => v !== null && v !== undefined).length;
  if (!isNum(row.total) || answered < row.total) return false;
  return isNum(row.score);
};

const mchatRec = (score: number): number => {
  if (score >= MCHAT_REFER) return 2;
  if (score >= MCHAT_FOLLOW) return 1;
  return 0;
};

const mchatBand = (score: number, rules: NlgPack['rules']): string => {
  if (score >= MCHAT_REFER) return rules.labelRiskHigh;
  if (score >= MCHAT_FOLLOW) return rules.labelRiskMed;
  return rules.labelRiskLow;
};

const imcLabel = (token: string | null, rules: NlgPack['rules']): string => {
  if (token === 'normo') return rules.labelImcRef;
  if (token === 'sobrepeso') return rules.labelImcSobrepeso;
  if (token === 'obesidad') return rules.labelImcObesidad;
  return rules.labelUnavailable;
};

const sahsLabel = (level: string, rules: NlgPack['rules']): string => {
  if (level === 'low') return rules.labelSahsLow;
  if (level === 'med') return rules.labelSahsMed;
  if (level === 'high') return rules.labelSahsHigh;
  return rules.labelUnavailable;
};

const reasonLabel = (reason: string, rules: NlgPack['rules']): string => {
  if (reason === 'empty') return rules.labelReasonEmpty;
  if (reason === 'silent') return rules.labelReasonSilent;
  if (reason === 'too-short') return rules.labelReasonShort;
  if (reason === 'no-voicing') return rules.labelReasonNoVoicing;
  return rules.labelReasonOther;
};

const findingLabel = (finding: string | null, rules: NlgPack['rules']): string | null => {
  if (finding === 'Cerumen') return rules.labelFindingCerumen;
  if (finding === 'OMA') return rules.labelFindingOma;
  if (finding === 'Perforación') return rules.labelFindingPerf;
  return null;
};

const restrictedDomains = (domains: ClinicalDomains | null, rules: NlgPack['rules']): string => {
  if (!domains) return rules.labelUnavailable;
  const rows: { kind: string | undefined; label: string }[] = [
    { kind: domains.visual?.kind, label: rules.labelDomainVisual },
    { kind: domains.motor?.kind, label: rules.labelDomainMotor },
    { kind: domains.verbal?.kind, label: rules.labelDomainVerbal },
    { kind: domains.otoscopia?.kind, label: rules.labelDomainOtoscopy },
  ];
  const bits = rows.filter(r => r.kind === 'warn' || r.kind === 'block').map(r => r.label);
  if (!bits.length) return rules.labelUnavailable;
  return bits.join(rules.labelListSep);
};

const phonemeGroups = (row: ArtRow, sep: string): string => {
  const order: string[] = [];
  const map = new Map<string, string[]>();
  for (const item of row.affectedPhonemes ?? []) {
    if (!item.phoneme) continue;
    const status = (row.phonemeStatus ?? []).find(s => normPhon(s.phoneme) === normPhon(item.phoneme));
    const place = status?.place?.trim() ?? '';
    const bucket = map.get(place);
    if (bucket) {
      bucket.push(item.phoneme);
    } else {
      map.set(place, [item.phoneme]);
      order.push(place);
    }
  }
  return order
    .map(place => {
      const phonemes = map.get(place) ?? [];
      const list = phonemes.join(sep);
      return place ? `${place}: ${list}` : list;
    })
    .join(sep);
};

const sodaText = (counts: ArtRow['sodaCounts'], rules: NlgPack['rules']): string => {
  const letter = (code: 'S' | 'O' | 'D' | 'A'): string | number => {
    const v = counts?.[code];
    return isNum(v) ? v : rules.labelUnavailable;
  };
  return [`S ${letter('S')}`, `O ${letter('O')}`, `D ${letter('D')}`, `A ${letter('A')}`].join(
    rules.labelListSep,
  );
};

const efDomainSlots = (row: EfRow, unavail: string, sep: string): { text: string; below: string; anyBelow: number; done: number } => {
  const parts: string[] = [];
  const below: string[] = [];
  for (const [code, field] of EF_FIELDS) {
    const score = row[field];
    if (!isNum(score)) continue;
    parts.push(`${code} ${score}/100`);
    if (score < EF_DOMAIN_CUT) below.push(code);
  }
  const done = parts.length;
  const text = done ? `(${done}/${EF_FIELDS.length}) ${parts.join(sep)}` : unavail;
  return {
    text,
    below: below.length ? below.join(sep) : unavail,
    anyBelow: below.length ? 1 : 0,
    done,
  };
};

const efCrossDetail = (row: EfRow, sep: string): string | null => {
  const bits: string[] = [];
  if (isNum(row.overallScore) && row.overallScore < EF_OVERALL_CROSS) {
    bits.push(`overall ${row.overallScore}`);
  }
  if (isNum(row.attentionScore) && row.attentionScore < EF_DOMAIN_CUT) {
    bits.push(`attention ${row.attentionScore}`);
  }
  if (isNum(row.inhibitionScore) && row.inhibitionScore < EF_DOMAIN_CUT) {
    bits.push(`inhibition ${row.inhibitionScore}`);
  }
  if (!bits.length) return null;
  return bits.join(sep);
};

const meanOf = (values: readonly (number | null)[]): number | null => {
  const done = values.filter(isNum);
  if (!done.length) return null;
  return Math.round(done.reduce((a, b) => a + b, 0) / done.length);
};

const factsFromCap = (rows: readonly CapRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    if (row.instrument && row.instrument !== 'CAP') continue;
    const measured = { id: row.id, globalResult: row.globalResult };
    if (row.globalResult === 'FULL') {
      out.push(makeFact('R-CAP-001', 'cap', 'info', rules.rCap001, measured, pack.audit.evidenceVersion));
    } else if (row.globalResult === 'PARTIAL') {
      out.push(
        makeFact(
          'R-CAP-002',
          'cap',
          'warning',
          rules.rCap002(restrictedDomains(row.domains, rules)),
          measured,
          pack.audit.evidenceVersion,
        ),
      );
    } else if (row.globalResult === 'BLOCKED') {
      out.push(makeFact('R-CAP-003', 'cap', 'warning', rules.rCap003, measured, pack.audit.evidenceVersion));
    }
  }
  return out;
};

const factsFromAud = (rows: readonly AudRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    const sides = sidesOf(row);
    const version = pack.audit.evidenceVersion;
    for (const s of sides) {
      if (determinedFreqs(s.ear).length) continue;
      out.push(
        makeFact(
          'R-AUD-001',
          'audiometry',
          'warning',
          rules.rAud001(earLabel(s.side, rules)),
          { id: row.id, ear: s.side },
          version,
        ),
      );
    }
    for (const s of sides) {
      const pta = displayedPta(row, s.side, s.ear);
      if (pta === null) continue;
      out.push(
        makeFact(
          'R-AUD-002',
          'audiometry',
          pta > PTA_REF_MAX ? 'warning' : 'info',
          rules.rAud002(earLabel(s.side, rules), pta, ptaBand(pta, rules), morphLabel(s.ear, rules)),
          { id: row.id, ear: s.side, pta },
          version,
        ),
      );
    }
    for (const s of sides) {
      if (!determinedFreqs(s.ear).length) continue;
      const missing = missingFreqs(s.ear);
      if (!missing.length) continue;
      const freqs = missing.map(hz => `${hz} Hz`).join(rules.labelListSep);
      out.push(
        makeFact(
          'R-AUD-003',
          'audiometry',
          'warning',
          rules.rAud003(earLabel(s.side, rules), freqs),
          { id: row.id, ear: s.side, freqs },
          version,
        ),
      );
    }
    for (const s of sides) {
      if (!needsReferral(s.ear)) continue;
      out.push(
        makeFact(
          'R-AUD-004',
          'audiometry',
          'warning',
          rules.rAud004(earLabel(s.side, rules)),
          { id: row.id, ear: s.side },
          version,
        ),
      );
    }
    if (row.transducer === 'soundfield' || hasCl(row.thresholds)) {
      out.push(makeFact('R-AUD-005', 'audiometry', 'info', rules.rAud005, { id: row.id }, version));
    }
  }
  return out;
};

const levelAt = (row: VerRow, level: number): VerRow['levelScores'][number] | undefined =>
  (row.levelScores ?? []).find(s => s.level === level);

const factsFromVer = (rows: readonly VerRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    const version = pack.audit.evidenceVersion;
    const srt = slotNum(row.srtDb, rules.labelUnavailable);
    if (row.presentedCount === 0) {
      out.push(makeFact('R-VER-001', 'verbal', 'warning', rules.rVer001, { id: row.id }, version));
    } else {
      const levels = [...(row.levelScores ?? [])].sort((a, b) => b.level - a.level);
      for (const level of levels) {
        out.push(
          makeFact(
            'R-VER-002',
            'verbal',
            'info',
            rules.rVer002(row.ageBand, level.pct, level.level, level.correct, level.presented, srt),
            { id: row.id, level: level.level, pct: level.pct, srt: isNum(row.srtDb) ? row.srtDb : null },
            version,
          ),
        );
      }
    }
    const borrowed = row.language === 'ca' || row.language === 'en' ? 1 : 0;
    const langLabel = textOrUnavail(row.language, rules.labelUnavailable);
    out.push(
      makeFact(
        'R-VER-003',
        'verbal',
        borrowed === 1 ? 'warning' : 'info',
        rules.rVer003(langLabel, borrowed),
        { id: row.id, language: row.language, borrowed },
        version,
      ),
    );
    const conv = row.presentedCount === 0 ? undefined : levelAt(row, CONV_LEVEL);
    if (conv && isNum(conv.pct) && conv.pct < DISC_MIN) {
      out.push(
        makeFact(
          'R-VER-004',
          'verbal',
          'warning',
          rules.rVer004(conv.pct, conv.level),
          { id: row.id, pct: conv.pct, level: conv.level },
          version,
        ),
      );
    }
  }
  return out;
};

const voiceOutsideBits = (row: VoiceRow): string[] => {
  const bits: string[] = [];
  if (isNum(row.f0) && f0Outside(row.f0)) bits.push(`F0 ${row.f0}`);
  if (isNum(row.jitter) && jitterOutside(row.jitter)) bits.push(`jitter ${row.jitter}`);
  if (isNum(row.shimmer) && shimmerOutside(row.shimmer)) bits.push(`shimmer ${row.shimmer}`);
  if (isNum(row.hnr) && hnrOutside(row.hnr)) bits.push(`HNR ${row.hnr}`);
  return bits;
};

const factsFromVoice = (rows: readonly VoiceRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    const version = pack.audit.evidenceVersion;
    const measured = {
      id: row.id,
      f0: isNum(row.f0) ? row.f0 : null,
      jitter: isNum(row.jitter) ? row.jitter : null,
      shimmer: isNum(row.shimmer) ? row.shimmer : null,
      hnr: isNum(row.hnr) ? row.hnr : null,
    };
    if (acousticsAbsent(row)) {
      out.push(
        makeFact('R-VOZ-001', 'voice', 'warning', rules.rVoz001(grbasText(row.grbas, rules)), measured, version),
      );
      continue;
    }
    const allNumeric = isNum(row.f0) && isNum(row.jitter) && isNum(row.shimmer) && isNum(row.hnr);
    const outside = voiceOutsideBits(row);
    let text = rules.rVoz002(
      slotNum(row.f0, rules.labelUnavailable),
      slotNum(row.jitter, rules.labelUnavailable),
      slotNum(row.shimmer, rules.labelUnavailable),
      slotNum(row.hnr, rules.labelUnavailable),
      formantText(row.formants, rules.labelListSep, rules.labelUnavailable),
    );
    if (allNumeric && outside.length === 0) text = `${text} ${rules.voiceWithinReference}`;
    out.push(makeFact('R-VOZ-002', 'voice', allNumeric ? 'info' : 'warning', text, measured, version));
    if (outside.length) {
      out.push(
        makeFact(
          'R-VOZ-003',
          'voice',
          'warning',
          rules.rVoz003(outside.join(rules.labelListSep)),
          measured,
          version,
        ),
      );
    }
    if (isNum(row.shimmer)) {
      const formantsMissing = row.formants === null || row.formants === undefined ? 1 : 0;
      out.push(
        makeFact(
          'R-VOZ-004',
          'voice',
          'info',
          rules.rVoz004(formantsMissing),
          { ...measured, formantsMissing },
          version,
        ),
      );
    }
  }
  return out;
};

const rateSlot = (v: number | null | undefined, unavail: string): string => (isNum(v) ? String(v) : unavail);

const factsFromPro = (rows: readonly ProRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    const version = pack.audit.evidenceVersion;
    if (row.reason !== 'ok') {
      out.push(
        makeFact(
          'R-PRO-001',
          'prosody',
          'warning',
          rules.rPro001(reasonLabel(row.reason, rules)),
          { id: row.id, reason: row.reason },
          version,
        ),
      );
      continue;
    }
    const m = row.metrics;
    const spanSec = m?.spanSec;
    const syllableCount = m?.syllableCount;
    const pauseCount = m?.pauseCount;
    const f0RangeSt = m?.f0RangeSt;
    const rates = `${rateSlot(m?.speechRateSps, rules.labelUnavailable)}/${rateSlot(m?.articulationRateSps, rules.labelUnavailable)}`;
    out.push(
      makeFact(
        'R-PRO-002',
        'prosody',
        'info',
        rules.rPro002(
          slotNum(spanSec, rules.labelUnavailable),
          slotNum(syllableCount, rules.labelUnavailable),
          slotNum(pauseCount, rules.labelUnavailable),
          slotNum(f0RangeSt, rules.labelUnavailable),
          rates,
        ),
        {
          id: row.id,
          spanSec: isNum(spanSec) ? spanSec : null,
          syllableCount: isNum(syllableCount) ? syllableCount : null,
          pauseCount: isNum(pauseCount) ? pauseCount : null,
          f0RangeSt: isNum(f0RangeSt) ? f0RangeSt : null,
        },
        version,
      ),
    );
  }
  return out;
};

const factsFromArt = (rows: readonly ArtRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    const version = pack.audit.evidenceVersion;
    if (row.evaluatedCount === 0) {
      out.push(makeFact('R-ART-001', 'articulation', 'warning', rules.rArt001, { id: row.id }, version));
      continue;
    }
    out.push(
      makeFact(
        'R-ART-002',
        'articulation',
        'info',
        rules.rArt002(
          row.evaluatedCount,
          row.totalCount,
          isNum(row.correctPct) ? row.correctPct : rules.labelUnavailable,
          sodaText(row.sodaCounts, rules),
        ),
        {
          id: row.id,
          evaluated: row.evaluatedCount,
          total: row.totalCount,
          pct: isNum(row.correctPct) ? row.correctPct : null,
        },
        version,
      ),
    );
    if ((row.affectedPhonemes ?? []).length) {
      out.push(
        makeFact(
          'R-ART-003',
          'articulation',
          'warning',
          rules.rArt003(phonemeGroups(row, rules.labelListSep)),
          { id: row.id, phonemes: (row.affectedPhonemes ?? []).length },
          version,
        ),
      );
    }
  }
  return out;
};

const factsFromAsha = (rows: readonly AshaRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byTextId(rows)) {
    const version = pack.audit.evidenceVersion;
    const domains = domainList(row.failedDomains ?? [], rules, rules.labelListSep);
    const measured = { id: row.id, riskLevel: row.riskLevel, ageBand: row.ageBand };
    if (row.riskLevel === 'green') {
      out.push(makeFact('R-ASH-001', 'asha', 'info', rules.rAsh001(row.ageBand), measured, version));
    } else if (row.riskLevel === 'yellow') {
      out.push(makeFact('R-ASH-002', 'asha', 'warning', rules.rAsh002(row.ageBand, domains), measured, version));
    } else if (row.riskLevel === 'red') {
      out.push(makeFact('R-ASH-003', 'asha', 'warning', rules.rAsh003(row.ageBand, domains), measured, version));
    }
  }
  return out;
};

const factsFromAut = (rows: readonly AutRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    if (row.instrument !== 'autism-tea') continue;
    const version = pack.audit.evidenceVersion;
    if (!mchatComplete(row)) {
      out.push(makeFact('R-AUT-001', 'autism', 'warning', rules.rAut001, { id: row.id }, version));
      continue;
    }
    const rec = mchatRec(row.score);
    out.push(
      makeFact(
        'R-AUT-002',
        'autism',
        rec === 0 ? 'info' : 'warning',
        rules.rAut002(row.score, mchatBand(row.score, rules), rec),
        { id: row.id, score: row.score, rec },
        version,
      ),
    );
  }
  return out;
};

const bolusPresent = (row: DysRow): boolean => Array.isArray(row.bolus) && row.bolus.length > 0;

const factsFromDys = (rows: readonly DysRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    if (!bolusPresent(row)) continue;
    const version = pack.audit.evidenceVersion;
    const recom = textOrUnavail(row.recommendation, rules.labelUnavailable);
    if (row.safetyAltered === true) {
      out.push(
        makeFact(
          'R-DYS-003',
          'dysphagia',
          'warning',
          rules.rDys003(slotNum(row.minSpO2, rules.labelUnavailable), slotNum(row.maxDrop, rules.labelUnavailable), recom),
          {
            id: row.id,
            minSpO2: isNum(row.minSpO2) ? row.minSpO2 : null,
            maxDrop: isNum(row.maxDrop) ? row.maxDrop : null,
          },
          version,
        ),
      );
    } else if (row.efficacyAltered === true && row.safetyAltered === false) {
      out.push(
        makeFact('R-DYS-002', 'dysphagia', 'warning', rules.rDys002(recom), { id: row.id }, version),
      );
    } else if (row.safetyAltered === false && row.efficacyAltered === false) {
      out.push(makeFact('R-DYS-001', 'dysphagia', 'info', rules.rDys001, { id: row.id }, version));
    }
  }
  return out;
};

const factsFromSahs = (rows: readonly SahsRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    const level = sahsLabel(row.suspicionLevel, rules);
    out.push(
      makeFact(
        'R-SAH-001',
        'sahs',
        row.suspicionLevel === 'low' ? 'info' : 'warning',
        rules.rSah001(
          row.psqYesCount,
          row.psqTotal,
          slotNum(row.brodsky, rules.labelUnavailable),
          imcLabel(row.imc, rules),
          level,
        ),
        {
          id: row.id,
          yes: row.psqYesCount,
          total: row.psqTotal,
          brodsky: isNum(row.brodsky) ? row.brodsky : null,
          suspicion: row.suspicionLevel,
        },
        pack.audit.evidenceVersion,
      ),
    );
  }
  return out;
};

const factsFromEf = (rows: readonly EfRow[], lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const out: ClinicalFact[] = [];
  for (const row of byNumericId(rows)) {
    const version = pack.audit.evidenceVersion;
    const slots = efDomainSlots(row, rules.labelUnavailable, rules.labelListSep);
    const overall = row.overallScore;
    if (!isNum(overall) || slots.done === 0) {
      out.push(
        makeFact(
          'R-EF-001',
          'executive',
          'warning',
          rules.rEf001,
          {
            id: row.id,
            overall: isNum(overall) ? overall : null,
            attention: isNum(row.attentionScore) ? row.attentionScore : null,
            inhibition: isNum(row.inhibitionScore) ? row.inhibitionScore : null,
          },
          version,
        ),
      );
      continue;
    }
    out.push(
      makeFact(
        'R-EF-002',
        'executive',
        slots.anyBelow === 1 ? 'warning' : 'info',
        rules.rEf002(row.ageBand, overall, slots.text, slots.below, slots.anyBelow),
        { id: row.id, overall, anyBelow: slots.anyBelow },
        version,
      ),
    );
  }
  return out;
};

const factsFromCross = (entities: SessionEntities, lang: UiLang): ClinicalFact[] => {
  const pack = nlg(lang);
  const rules = pack.rules;
  const version = pack.audit.evidenceVersion;
  const sep = rules.labelListSep;
  const out: ClinicalFact[] = [];
  const caps = byNumericId(listOf(entities.clinicalAssessments));
  const auds = byNumericId(listOf(entities.audiometries));
  const verbals = byNumericId(listOf(entities.verbalAudiometries));
  const arts = byNumericId(listOf(entities.articulations));
  const voices = byNumericId(listOf(entities.voiceAnalyses));
  const dysphagias = byNumericId(listOf(entities.dysphagias));
  const ashas = byTextId(listOf(entities.ashaTests));
  const autisms = byNumericId(listOf(entities.screenings)).filter(row => row.instrument === 'autism-tea');
  const sahsRows = byNumericId(listOf(entities.sahsScreenings));
  const efs = byNumericId(listOf(entities.executiveFunctions));

  for (const cap of caps) {
    const ears: { side: 'OD' | 'OI'; finding: string | null }[] = [
      { side: 'OD', finding: cap.domains?.otoscopia?.od ?? null },
      { side: 'OI', finding: cap.domains?.otoscopia?.oi ?? null },
    ];
    for (const aud of auds) {
      for (const ear of ears) {
        const label = findingLabel(ear.finding, rules);
        if (!label) continue;
        if (!determinedFreqs(earOf(aud.thresholds, ear.side)).length) continue;
        out.push(
          makeFact(
            'R-CROSS-001',
            'cross',
            'warning',
            rules.rCross001(earLabel(ear.side, rules), label),
            { capId: cap.id, audId: aud.id, ear: ear.side, finding: ear.finding },
            version,
          ),
        );
      }
    }
  }

  for (const cap of caps) {
    const ome: { side: 'OD' | 'OI' }[] = [];
    if (cap.domains?.otoscopia?.od === 'OME') ome.push({ side: 'OD' });
    if (cap.domains?.otoscopia?.oi === 'OME') ome.push({ side: 'OI' });
    for (const aud of auds) {
      for (const ear of ome) {
        const stored = ear.side === 'OD' ? aud.ptaOD : aud.ptaOI;
        const pta = sidePta(stored, earOf(aud.thresholds, ear.side));
        if (!isNum(pta) || pta <= PTA_REF_MAX) continue;
        out.push(
          makeFact(
            'R-CROSS-002',
            'cross',
            'warning',
            rules.rCross002(earLabel(ear.side, rules), pta),
            { capId: cap.id, audId: aud.id, ear: ear.side, pta },
            version,
          ),
        );
      }
    }
  }

  for (const aud of auds) {
    const pta = bestPta(aud);
    if (!isNum(pta) || pta > PTA_REF_MAX) continue;
    for (const verbal of verbals) {
      const conv = (verbal.levelScores ?? []).find(s => s.level === CONV_LEVEL);
      const disc = conv && isNum(conv.pct) && conv.pct < DISC_MIN;
      const gap = isNum(verbal.srtDb) ? Math.abs(verbal.srtDb - pta) : null;
      const gapFires = isNum(gap) && gap > SRT_MARGIN;
      if (!disc && !gapFires) continue;
      const details: string[] = [];
      if (disc && conv) details.push(rules.rCross003Disc(conv.pct, conv.level));
      if (gapFires && isNum(gap)) details.push(rules.rCross003Gap(gap));
      out.push(
        makeFact(
          'R-CROSS-003',
          'cross',
          'warning',
          rules.rCross003(pta, details.join(sep)),
          {
            audId: aud.id,
            verbalId: verbal.id,
            bestPta: pta,
            pct: conv && isNum(conv.pct) ? conv.pct : null,
            srt: isNum(verbal.srtDb) ? verbal.srtDb : null,
            gap: isNum(gap) ? gap : null,
          },
          version,
        ),
      );
    }
  }

  for (const aud of auds) {
    const freqs = highFreqLabels(aud, rules);
    if (!freqs.length) continue;
    for (const art of arts) {
      const phonemes = fricativesOf(art);
      if (!phonemes.length) continue;
      out.push(
        makeFact(
          'R-CROSS-004',
          'cross',
          'warning',
          rules.rCross004(freqs.join(sep), phonemes.join(sep)),
          { audId: aud.id, artId: art.id },
          version,
        ),
      );
    }
  }

  for (const voice of voices) {
    if (!laryngealOutside(voice)) continue;
    for (const dys of dysphagias) {
      if (dys.safetyAltered !== true) continue;
      out.push(
        makeFact(
          'R-CROSS-005',
          'cross',
          'warning',
          rules.rCross005(
            slotNum(voice.jitter, rules.labelUnavailable),
            slotNum(voice.shimmer, rules.labelUnavailable),
            slotNum(voice.hnr, rules.labelUnavailable),
          ),
          {
            voiceId: voice.id,
            dysId: dys.id,
            jitter: isNum(voice.jitter) ? voice.jitter : null,
            shimmer: isNum(voice.shimmer) ? voice.shimmer : null,
            hnr: isNum(voice.hnr) ? voice.hnr : null,
          },
          version,
        ),
      );
    }
  }

  for (const asha of ashas) {
    if (!ashaTriggersCross(asha)) continue;
    const domains = domainList(asha.failedDomains ?? [], rules, sep);
    const ashaDetail = domains === rules.labelUnavailable ? asha.ageBand : `${asha.ageBand}${sep}${domains}`;
    for (const aut of autisms) {
      if (!isNum(aut.score) || aut.score < MCHAT_FOLLOW) continue;
      out.push(
        makeFact(
          'R-CROSS-006',
          'cross',
          'warning',
          rules.rCross006(ashaDetail, aut.score),
          { ashaId: asha.id, autId: aut.id, score: aut.score },
          version,
        ),
      );
    }
  }

  for (const sah of sahsRows) {
    if (sah.suspicionLevel !== 'med' && sah.suspicionLevel !== 'high') continue;
    for (const ef of efs) {
      const detail = efCrossDetail(ef, sep);
      if (!detail) continue;
      out.push(
        makeFact(
          'R-CROSS-007',
          'cross',
          'warning',
          rules.rCross007(sahsLabel(sah.suspicionLevel, rules), detail),
          { sahsId: sah.id, efId: ef.id, suspicion: sah.suspicionLevel },
          version,
        ),
      );
    }
  }

  return out;
};

export function evaluateCapFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromCap(listOf(entities.clinicalAssessments), lang);
}

export function evaluateAudiometryFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromAud(listOf(entities.audiometries), lang);
}

export function evaluateVerbalFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromVer(listOf(entities.verbalAudiometries), lang);
}

export function evaluateVoiceFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromVoice(listOf(entities.voiceAnalyses), lang);
}

export function evaluateProsodyFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromPro(listOf(entities.prosodyAnalyses), lang);
}

export function evaluateArticulationFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromArt(listOf(entities.articulations), lang);
}

export function evaluateAshaFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromAsha(listOf(entities.ashaTests), lang);
}

export function evaluateAutismFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromAut(listOf(entities.screenings), lang);
}

export function evaluateDysphagiaFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromDys(listOf(entities.dysphagias), lang);
}

export function evaluateSahsFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromSahs(listOf(entities.sahsScreenings), lang);
}

export function evaluateEfFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromEf(listOf(entities.executiveFunctions), lang);
}

export function evaluateCrossModuleFacts(entities: SessionEntities, lang: UiLang): ClinicalFact[] {
  return factsFromCross(entities, lang);
}

const emptySynthesis = (useLang: UiLang, reason: 'catalog-missing'): NlgReportSynthesis => ({
  lang: useLang,
  facts: [],
  ruleIds: [],
  crossModuleFindings: [],
  formattedReportText: nlgMissingDataMessage(useLang),
  unavailableReason: reason,
});

export function evaluateSessionNlg(entities: SessionEntities, lang?: UiLang): NlgReportSynthesis {
  const useLang = lang ?? getUiLang();
  if (!catalogPack(useLang)) return emptySynthesis(useLang, 'catalog-missing');
  const facts = [
    ...evaluateCapFacts(entities, useLang),
    ...evaluateCrossModuleFacts(entities, useLang),
    ...evaluateAudiometryFacts(entities, useLang),
    ...evaluateVerbalFacts(entities, useLang),
    ...evaluateVoiceFacts(entities, useLang),
    ...evaluateProsodyFacts(entities, useLang),
    ...evaluateArticulationFacts(entities, useLang),
    ...evaluateAshaFacts(entities, useLang),
    ...evaluateAutismFacts(entities, useLang),
    ...evaluateDysphagiaFacts(entities, useLang),
    ...evaluateSahsFacts(entities, useLang),
    ...evaluateEfFacts(entities, useLang),
  ];
  const formattedReportText =
    facts.length === 0
      ? ''
      : `${facts.map(f => f.text).join('\n')}\n${nlg(useLang).sections.metrologicalDisclaimer}`;
  return {
    lang: useLang,
    facts,
    ruleIds: facts.map(f => f.ruleId),
    crossModuleFindings: facts.filter(f => f.category === 'cross'),
    formattedReportText,
    unavailableReason: null,
  };
}

export function renderAudiometryInterpretation(thresholds: AudiometryThresholds, lang: UiLang): string {
  if (!catalogPack(lang)) return nlgMissingDataMessage(lang);
  const transducer = hasCl(thresholds) ? 'soundfield' : 'air';
  return joinText(
    factsFromAud([{ id: 0, transducer, thresholds, ptaOD: null, ptaOI: null }], lang),
  );
}

export function renderVerbalInterpretation(
  band: 'A' | 'B' | 'C' | 'D',
  score: {
    levelScores: { level: number; presented: number; correct: number; pct: number }[];
    presentedCount: number;
    correctCount: number;
    discriminationPct: number;
  },
  srtDb: number | null,
  sessionLang: string,
  lang: UiLang,
): string {
  if (!catalogPack(lang)) return nlgMissingDataMessage(lang);
  return joinText(
    factsFromVer(
      [
        {
          id: 0,
          ageBand: band,
          language: sessionLang,
          presentedCount: score.presentedCount,
          correctCount: score.correctCount,
          levelScores: score.levelScores ?? [],
          srtDb,
        },
      ],
      lang,
    ),
  );
}

export function renderVoiceInterpretation(
  p: {
    f0: number;
    jitter: number;
    shimmer: number;
    hnr: number;
    formants: VoiceFormants | null;
  },
  lang: UiLang,
): string {
  if (!catalogPack(lang)) return nlgMissingDataMessage(lang);
  return joinText(
    factsFromVoice(
      [
        {
          id: 0,
          f0: p.f0,
          jitter: p.jitter,
          shimmer: p.shimmer,
          hnr: p.hnr,
          formants: p.formants,
          grbas: null,
        },
      ],
      lang,
    ),
  );
}

export function renderGrbasSeverityLabel(g: GrbasScores, lang: UiLang): string {
  const pack = catalogPack(lang);
  if (!pack) return nlgMissingDataMessage(lang);
  return grbasText(g, pack.rules);
}

export function renderDysphagiaInterpretation(
  input: {
    verdict: 'safe' | 'efficacy' | 'safety';
    minSpO2: number | null;
    maxDrop: number | null;
    recommendation: string;
  },
  lang: UiLang,
): string {
  const pack = catalogPack(lang);
  if (!pack) return nlgMissingDataMessage(lang);
  const rules = pack.rules;
  const recom = textOrUnavail(input.recommendation, rules.labelUnavailable);
  if (input.verdict === 'safe') return rules.rDys001;
  if (input.verdict === 'efficacy') return rules.rDys002(recom);
  if (input.verdict === 'safety') {
    return rules.rDys003(
      slotNum(input.minSpO2, rules.labelUnavailable),
      slotNum(input.maxDrop, rules.labelUnavailable),
      recom,
    );
  }
  return '';
}

export function renderExecutiveInterpretation(
  band: 'A' | 'B' | 'C' | 'D',
  scores: {
    attention: number | null;
    inhibition: number | null;
    flexibility: number | null;
    workingMemory: number | null;
    planning: number | null;
  },
  lang: UiLang,
): string {
  if (!catalogPack(lang)) return nlgMissingDataMessage(lang);
  return joinText(
    factsFromEf(
      [
        {
          id: 0,
          ageBand: band,
          attentionScore: scores.attention,
          inhibitionScore: scores.inhibition,
          flexibilityScore: scores.flexibility,
          workingMemoryScore: scores.workingMemory,
          planningScore: scores.planning,
          overallScore: meanOf([
            scores.attention,
            scores.inhibition,
            scores.flexibility,
            scores.workingMemory,
            scores.planning,
          ]),
        },
      ],
      lang,
    ),
  );
}
