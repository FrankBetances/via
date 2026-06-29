/* -------------------------------------------------------------------------- */
/*  Lógica clínica pura del cribado de SAHS infantil (sin dependencias UI/DB)  */
/* -------------------------------------------------------------------------- */
/*  La persistencia vive en la entidad `SahsScreening` + `SahsScreeningRepo` + */
/*  el módulo de servicio `sahsScreenings`. Aquí solo está el modelo del        */
/*  cuestionario PSQ de Chervin, la exploración y el cálculo del nivel de       */
/*  sospecha + recomendación de derivación, reutilizable por la pantalla, el    */
/*  archivo de evaluaciones y el PDF.                                           */
/*                                                                              */
/*  ⚠ Cribado orientativo de trastornos respiratorios del sueño. El            */
/*  diagnóstico de SAHS requiere polisomnografía en Unidad de Sueño. La         */
/*  puntuación combinada es un modelo de apoyo transparente, no una escala      */
/*  cerrada validada; ajústela a los criterios del centro si procede.           */
/* -------------------------------------------------------------------------- */

export type SahsSuspicion = 'low' | 'med' | 'high';
export type SahsSuspicionOrInc = SahsSuspicion | 'inc';
export type ImcCategory = 'normo' | 'sobrepeso' | 'obesidad';

export type PsqAnswers = Record<number, boolean | null>;

export interface PsqQuestion {
  id: number;
  code: string;
  label: string;
  block: number; // 0..3
  flag?: boolean; // señal de alarma (apnea presenciada / preocupación por la respiración)
}

export interface PsqBlock {
  name: string;
  short: string;
  range: [number, number];
}

export interface BrodskyOption {
  grade: number;
  sub: string;
}

export interface ImcOption {
  key: ImcCategory;
  label: string;
  sub: string;
}

export interface RiskFactor {
  label: string;
  note: string;
}

/* --------------------------- PSQ de Chervin (SRBD-22) --------------------- */
/*  Subescala de trastorno respiratorio del sueño del Pediatric Sleep          */
/*  Questionnaire. 22 ítems Sí/No referidos por el cuidador. En esta escala     */
/*  la respuesta de riesgo es SIEMPRE «Sí» (síntoma presente).                  */

export const PSQ_TOTAL = 22;

export const PSQ_BLOCKS: PsqBlock[] = [
  { name: 'Ronquido y respiración', short: 'Ronquido', range: [1, 5] },
  { name: 'Apneas y signos obstructivos', short: 'Apneas', range: [6, 9] },
  { name: 'Sueño y somnolencia diurna', short: 'Somnolencia', range: [10, 14] },
  { name: 'Conducta, atención e hiperactividad', short: 'Conducta', range: [15, 22] },
];

export const PSQ_QUESTIONS: PsqQuestion[] = [
  { id: 1, code: 'Q-01', block: 0, label: '¿Ronca más de la mitad de las noches?' },
  { id: 2, code: 'Q-02', block: 0, label: '¿Ronca todas las noches?' },
  { id: 3, code: 'Q-03', block: 0, label: '¿Ronca fuerte?' },
  { id: 4, code: 'Q-04', block: 0, label: '¿Respiración ruidosa o agitada mientras duerme?' },
  { id: 5, code: 'Q-05', block: 0, label: '¿Hace esfuerzo o "lucha" para respirar al dormir?' },
  { id: 6, code: 'Q-06', block: 1, flag: true, label: '¿Le ha visto dejar de respirar durante la noche?' },
  { id: 7, code: 'Q-07', block: 1, flag: true, label: '¿Le preocupa la respiración de su hijo/a al dormir?' },
  { id: 8, code: 'Q-08', block: 1, label: '¿Respira por la boca durante el día?' },
  { id: 9, code: 'Q-09', block: 1, label: '¿Amanece con la boca seca?' },
  { id: 10, code: 'Q-10', block: 2, label: '¿Moja la cama por las noches? (enuresis)' },
  { id: 11, code: 'Q-11', block: 2, label: '¿Se despierta poco descansado por la mañana?' },
  { id: 12, code: 'Q-12', block: 2, label: '¿Tiene somnolencia durante el día?' },
  { id: 13, code: 'Q-13', block: 2, label: '¿Le han comentado en el colegio que parece adormilado?' },
  { id: 14, code: 'Q-14', block: 2, label: '¿Cuesta despertarlo por la mañana?' },
  { id: 15, code: 'Q-15', block: 3, label: '¿No parece escuchar cuando se le habla directamente?' },
  { id: 16, code: 'Q-16', block: 3, label: '¿Le cuesta organizar tareas y actividades?' },
  { id: 17, code: 'Q-17', block: 3, label: '¿Se distrae con facilidad?' },
  { id: 18, code: 'Q-18', block: 3, label: '¿Mueve sin parar manos o pies; se retuerce en el asiento?' },
  { id: 19, code: 'Q-19', block: 3, label: '¿Está "en marcha", como impulsado por un motor?' },
  { id: 20, code: 'Q-20', block: 3, label: '¿Interrumpe o se entromete con los demás?' },
  { id: 21, code: 'Q-21', block: 3, label: '¿Habla en exceso?' },
  { id: 22, code: 'Q-22', block: 3, label: '¿Le cuesta esperar su turno?' },
];

/* ------------------------------ Exploración física ----------------------- */

export const BRODSKY_OPTIONS: BrodskyOption[] = [
  { grade: 0, sub: 'En fosa' },
  { grade: 1, sub: '< 25 %' },
  { grade: 2, sub: '25–50 %' },
  { grade: 3, sub: '50–75 %' },
  { grade: 4, sub: '> 75 %' },
];

export const IMC_OPTIONS: ImcOption[] = [
  { key: 'normo', label: 'Normopeso', sub: 'P < 85' },
  { key: 'sobrepeso', label: 'Sobrepeso', sub: 'P 85–95' },
  { key: 'obesidad', label: 'Obesidad', sub: 'P ≥ 95' },
];

export const EXAM_SIGNS: string[] = [
  'Facies adenoidea',
  'Respiración bucal diurna',
  'Micro/retrognatia',
  'Macroglosia',
  'Obstrucción nasal',
  'Paladar ojival',
];

export const RISK_FACTORS: RiskFactor[] = [
  { label: 'Antecedentes familiares de SAHS', note: 'Padres/hermanos con SAHS o adenoamigdalectomía' },
  { label: 'Hipertrofia adenoamigdalar', note: 'Conocida o documentada previamente' },
  { label: 'Rinitis alérgica / asma', note: 'Alteraciones rinosinusales, inflamación' },
  { label: 'Prematuridad', note: 'Antecedente de prematuridad' },
  { label: 'Síndrome craneofacial / Down', note: 'Down, Pierre Robin, Crouzon, etc.' },
  { label: 'Enf. neuromuscular', note: 'Hipotonía, parálisis cerebral, distrofia' },
  { label: 'Enuresis nocturna', note: 'OR ≈ 5,3 de SAHS asociado' },
  { label: 'Síntomas de TDAH', note: 'Inatención, hiperactividad, fracaso escolar' },
  { label: 'Convive con fumadores', note: 'Exposición a humo de tabaco' },
  { label: 'Nivel socioeconómico bajo', note: 'Mayor prevalencia y repercusión clínica' },
];

/* ------------------------------ Modelo de cálculo ------------------------ */

export const SAHS_SCORE_MAX = 13; // 3 (PSQ) + 2 (apneas) + 3 (Brodsky) + 2 (IMC) + 3 (factores)

export interface SahsInput {
  psq: PsqAnswers;
  brodsky: number | null;
  imc: ImcCategory | null;
  riskFactors: string[]; // etiquetas marcadas
}

export interface SahsScoreBreakdown {
  psq: number;
  apnea: number;
  brodsky: number;
  imc: number;
  risk: number;
}

export interface SahsScore {
  yesCount: number;
  answeredCount: number;
  prop: number; // 0..1
  psqPositive: boolean;
  redFlag: boolean;
  breakdown: SahsScoreBreakdown;
  total: number;
  totalMax: number;
  level: SahsSuspicion;
}

/** ¿Está la respuesta marcada como de riesgo? En el PSQ, «Sí» = síntoma presente. */
export const isPsqRisk = (v: boolean | null | undefined): boolean => v === true;

/** Cribado positivo del PSQ: ≥ 33 % de ítems «Sí» (≈ 8/22). */
export const isPsqPositive = (yesCount: number): boolean => yesCount / PSQ_TOTAL >= 0.33;

export const computeSahsScore = (input: SahsInput): SahsScore => {
  const { psq, brodsky, imc, riskFactors } = input;

  let yesCount = 0;
  let answeredCount = 0;
  for (let i = 1; i <= PSQ_TOTAL; i++) {
    const v = psq[i];
    if (v === true || v === false) answeredCount++;
    if (v === true) yesCount++;
  }
  const prop = yesCount / PSQ_TOTAL;
  const psqPositive = prop >= 0.33;
  const redFlag = psq[6] === true || psq[7] === true;

  const psqPts = prop >= 0.5 ? 3 : prop >= 0.33 ? 2 : 0;
  const apneaPts = redFlag ? 2 : 0;
  const brodskyPts = brodsky != null && brodsky >= 4 ? 3 : brodsky === 3 ? 2 : 0;
  const imcPts = imc === 'obesidad' ? 2 : imc === 'sobrepeso' ? 1 : 0;
  const riskPts = Math.min(riskFactors.length, 3);
  const total = psqPts + apneaPts + brodskyPts + imcPts + riskPts;

  let level: SahsSuspicion = total >= 6 ? 'high' : total >= 3 ? 'med' : 'low';
  // Override clínico: PSQ positivo + apnea presenciada eleva siempre a alta.
  if (psqPositive && redFlag && level === 'med') level = 'high';

  return {
    yesCount,
    answeredCount,
    prop,
    psqPositive,
    redFlag,
    breakdown: { psq: psqPts, apnea: apneaPts, brodsky: brodskyPts, imc: imcPts, risk: riskPts },
    total,
    totalMax: SAHS_SCORE_MAX,
    level,
  };
};

export const suspicionLabel = (level: SahsSuspicionOrInc): string => {
  switch (level) {
    case 'high':
      return 'Sospecha alta';
    case 'med':
      return 'Sospecha media';
    case 'low':
      return 'Sospecha baja';
    default:
      return 'Incompleto';
  }
};

export interface SahsRecommendation {
  action: string;
  desc: string;
  referral: string; // destino / vía sugerida
}

export const recommendationFor = (level: SahsSuspicion): SahsRecommendation => {
  switch (level) {
    case 'high':
      return {
        action: 'Derivar a Unidad de Sueño',
        desc: 'Alta probabilidad de SAHS. Solicitar polisomnografía (patrón oro). Priorizar ante apneas presenciadas, Brodsky 3–4 u obesidad.',
        referral: 'PSG · ORL',
      };
    case 'med':
      return {
        action: 'Valorar derivación',
        desc: 'Sospecha intermedia. Considerar prueba terapéutica (corticoide nasal / montelukast) y/o pulsioximetría nocturna. Repetir cribado en 1–3 meses.',
        referral: 'PR · Pulsioximetría',
      };
    default:
      return {
        action: 'Control evolutivo',
        desc: 'Hallazgos compatibles con ronquido primario. Reevaluar en las revisiones de salud. Volver a cribar si aparecen apneas presenciadas o empeoramiento.',
        referral: 'Revisión de salud',
      };
  }
};

export const imcLabel = (imc: ImcCategory | null): string => {
  const found = IMC_OPTIONS.find(o => o.key === imc);
  return found ? found.label : '—';
};
