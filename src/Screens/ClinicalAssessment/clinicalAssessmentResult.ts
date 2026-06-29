/* -------------------------------------------------------------------------- */
/*  Lógica clínica pura del Certificado de Aptitud para la Prueba (CAP)         */
/*  Sin dependencias de UI ni de BD. Reutilizable por la pantalla, el archivo   */
/*  de evaluaciones y el informe PDF.                                           */
/* -------------------------------------------------------------------------- */
/*  El CAP certifica las condiciones MÍNIMAS de viabilidad de la prueba en 4    */
/*  dominios (otoscopia, capacidad visual, verbal y motora) y deriva qué        */
/*  pruebas/juegos quedan habilitados o bloqueados en la sesión. No es un        */
/*  diagnóstico clínico.                                                        */
/* -------------------------------------------------------------------------- */

export type DomainKind = 'pending' | 'ok' | 'warn' | 'block';
export type GlobalResult = 'FULL' | 'PARTIAL' | 'BLOCKED';
export type EarFinding = 'Normal' | 'Cerumen' | 'OMA' | 'OME' | 'Perforación' | 'DTT' | 'Otro' | null;
export type AgeGroup = 'A' | 'B' | 'C';

/** Hallazgos otoscópicos seleccionables por oído. */
export const FINDING_OPTIONS: Exclude<EarFinding, null>[] = ['Normal', 'Cerumen', 'OMA', 'OME', 'Perforación', 'DTT', 'Otro'];

/** Hallazgos que bloquean por completo la audiometría de ese oído. */
export const BLOCKING_FINDINGS: Exclude<EarFinding, null>[] = ['Cerumen', 'OMA', 'Perforación'];

/* --------------------------------- Ítems ---------------------------------- */

export interface DomainItem {
  id: string;
  code: string;
  label: string;
  note?: string;
}

export const VISUAL_ITEMS: DomainItem[] = [
  { id: 'V01', code: 'V-01', label: 'Fija la mirada en la pantalla de la tablet' },
  { id: 'V02', code: 'V-02', label: 'Distingue entre al menos dos imágenes en pantalla' },
  { id: 'V03', code: 'V-03', label: 'Señala o toca un objeto indicado en la pantalla' },
  { id: 'V04', code: 'V-04', label: 'Sin nistagmo marcado ni desviación ocular severa' },
];

export const MOTOR_ITEMS: DomainItem[] = [
  { id: 'M01', code: 'M-01', label: 'Realiza un tap en un objetivo de ≥4 cm' },
  { id: 'M02', code: 'M-02', label: 'Hace tap en dos objetivos distintos (sin perseveración)' },
  { id: 'M03', code: 'M-03', label: 'Realiza un gesto de arrastre (drag) de ≥3 cm', note: 'Solo limita los juegos con arrastre' },
  { id: 'M04', code: 'M-04', label: 'Sin movimientos involuntarios severos que impidan el control' },
];

export const VERBAL_GROUPS: Record<AgeGroup, { label: string; items: DomainItem[] }> = {
  A: {
    label: 'Grupo A · 18 m – 2 a 11 m',
    items: [
      { id: 'VB1', code: 'VB-A-01', label: 'Responde a su nombre cuando se le llama' },
      { id: 'VB2', code: 'VB-A-02', label: 'Señala o mira hacia una fuente sonora' },
      { id: 'VB3', code: 'VB-A-03', label: 'Comprende una instrucción simple ("ven", "dame")' },
    ],
  },
  B: {
    label: 'Grupo B · 3 a – 4 a 11 m',
    items: [
      { id: 'VB1', code: 'VB-B-01', label: 'Comprende una instrucción de dos pasos' },
      { id: 'VB2', code: 'VB-B-02', label: 'Repite una sílaba o palabra simple a petición' },
      { id: 'VB3', code: 'VB-B-03', label: 'Responde verbalmente ante una pregunta simple' },
    ],
  },
  C: {
    label: 'Grupo C · 5 años y mayores',
    items: [
      { id: 'VB1', code: 'VB-C-01', label: 'Comprende las instrucciones tras una demostración' },
      { id: 'VB2', code: 'VB-C-02', label: 'Repite palabras bisílabas con claridad' },
      { id: 'VB3', code: 'VB-C-03', label: 'Mantiene la atención 2–3 min en una tarea' },
    ],
  },
};

/* --------------------------------- Estado --------------------------------- */

export type YesNo = boolean | null;

export interface ClinicalAssessmentState {
  od: EarFinding;
  oi: EarFinding;
  odNotes: string;
  oiNotes: string;
  visual: Record<string, YesNo>;
  verbal: Record<string, YesNo>;
  motor: Record<string, YesNo>;
  ageGroup: AgeGroup;
}

export const emptyState = (): ClinicalAssessmentState => ({
  od: null,
  oi: null,
  odNotes: '',
  oiNotes: '',
  visual: { V01: null, V02: null, V03: null, V04: null },
  verbal: { VB1: null, VB2: null, VB3: null },
  motor: { M01: null, M02: null, M03: null, M04: null },
  ageGroup: 'B',
});

/* ------------------------------ Derivaciones ------------------------------ */

export const earSeverity = (f: EarFinding): 0 | 1 | 2 | 3 => {
  if (!f) return 0;
  if (f === 'Normal') return 1;
  if (BLOCKING_FINDINGS.includes(f)) return 3;
  return 2; // OME, DTT, Otro
};

export const earUsable = (f: EarFinding): boolean => !!f && !BLOCKING_FINDINGS.includes(f);

export interface GameGate {
  code: string;
  title: string;
  active: boolean;
  reason: string; // 'Habilitado' o el motivo de bloqueo
}

export interface ClinicalAnalysis {
  otoKind: DomainKind;
  visKind: DomainKind;
  verKind: DomainKind;
  motKind: DomainKind;
  anyEarOk: boolean;
  vBlocked: boolean;
  verbalProdBlocked: boolean;
  motorAllBlocked: boolean;
  dragBlocked: boolean;
  games: GameGate[];
  activeCount: number;
  totalGames: number;
  global: GlobalResult;
  globalLabel: string;
  globalDesc: string;
  globalKind: Exclude<DomainKind, 'pending'>;
}

const allAnswered = (rec: Record<string, YesNo>, keys: string[]): boolean => keys.every(k => typeof rec[k] === 'boolean');

/** Núcleo de la lógica: toma el estado y devuelve estados por dominio, gating de juegos y veredicto global. */
export function analyzeClinicalAssessment(s: ClinicalAssessmentState): ClinicalAnalysis {
  // --- Otoscopia ---
  const so = earSeverity(s.od);
  const si = earSeverity(s.oi);
  const otoKind: DomainKind =
    so === 0 && si === 0 ? 'pending' : so >= 3 && si >= 3 ? 'block' : so >= 2 || si >= 2 ? 'warn' : 'ok';
  const anyEarOk = earUsable(s.od) || earUsable(s.oi);

  // --- Visual ---
  const vKeys = ['V01', 'V02', 'V03', 'V04'];
  const vAnswered = allAnswered(s.visual, vKeys);
  const vBlocked = s.visual.V02 === false || s.visual.V03 === false;
  const visKind: DomainKind = !vAnswered ? 'pending' : vBlocked ? 'block' : vKeys.every(k => s.visual[k]) ? 'ok' : 'warn';

  // --- Verbal ---
  const vbKeys = ['VB1', 'VB2', 'VB3'];
  const vbAnswered = allAnswered(s.verbal, vbKeys);
  const vbTrue = vbKeys.filter(k => s.verbal[k] === true).length;
  const verbalProdBlocked = vbAnswered && vbTrue / 3 < 0.5;
  const verKind: DomainKind = !vbAnswered ? 'pending' : verbalProdBlocked ? 'block' : vbTrue === 3 ? 'ok' : 'warn';

  // --- Motor ---
  const mKeys = ['M01', 'M02', 'M03', 'M04'];
  const mAnswered = allAnswered(s.motor, mKeys);
  const motorAllBlocked = s.motor.M01 === false;
  const dragBlocked = s.motor.M03 === false;
  const motKind: DomainKind = !mAnswered ? 'pending' : motorAllBlocked ? 'block' : mKeys.every(k => s.motor[k]) ? 'ok' : 'warn';

  // --- Gating de juegos ---
  const audioReason = motorAllBlocked
    ? 'Sin interacción táctil (M-01)'
    : !anyEarOk
      ? 'Ambos oídos bloqueados'
      : vBlocked
        ? 'Capacidad visual insuficiente'
        : '';

  const def: { code: string; title: string; reason: string }[] = [
    {
      code: 'J01',
      title: 'Atención y Memoria',
      reason: motorAllBlocked
        ? 'Sin interacción táctil (M-01)'
        : dragBlocked
          ? 'Requiere arrastre (M-03)'
          : vBlocked
            ? 'Capacidad visual insuficiente'
            : '',
    },
    { code: 'J02', title: 'Detección de Sonidos', reason: audioReason },
    { code: 'J03', title: 'Comprensión de Palabras', reason: audioReason },
    {
      code: 'J04',
      title: 'Imitación Verbal',
      reason: motorAllBlocked
        ? 'Sin interacción táctil (M-01)'
        : !anyEarOk
          ? 'Ambos oídos bloqueados'
          : verbalProdBlocked
            ? 'Producción verbal insuficiente'
            : '',
    },
    {
      code: 'J05',
      title: 'Toca Solo Si…',
      reason: motorAllBlocked ? 'Sin interacción táctil (M-01)' : vBlocked ? 'Capacidad visual insuficiente' : '',
    },
  ];

  const games: GameGate[] = def.map(g => ({
    code: g.code,
    title: g.title,
    active: !g.reason,
    reason: g.reason || 'Habilitado',
  }));
  const activeCount = games.filter(g => g.active).length;
  const totalGames = games.length;

  const global: GlobalResult = activeCount === totalGames ? 'FULL' : activeCount === 0 ? 'BLOCKED' : 'PARTIAL';
  const globalMap: Record<GlobalResult, { label: string; desc: string; kind: Exclude<DomainKind, 'pending'> }> = {
    FULL: { label: 'APTO · COMPLETO', desc: 'Todas las pruebas habilitadas para esta sesión.', kind: 'ok' },
    PARTIAL: {
      label: 'APTO PARCIAL',
      desc: `${activeCount} de ${totalGames} pruebas habilitadas. Revise las restricciones antes de continuar.`,
      kind: 'warn',
    },
    BLOCKED: { label: 'NO APTO', desc: 'Ninguna prueba viable hoy. Registre observaciones y reprograme la sesión.', kind: 'block' },
  };

  return {
    otoKind,
    visKind,
    verKind,
    motKind,
    anyEarOk,
    vBlocked,
    verbalProdBlocked,
    motorAllBlocked,
    dragBlocked,
    games,
    activeCount,
    totalGames,
    global,
    globalLabel: globalMap[global].label,
    globalDesc: globalMap[global].desc,
    globalKind: globalMap[global].kind,
  };
}

export const DOMAIN_LABELS: Record<DomainKind, string> = {
  pending: 'Pendiente',
  ok: 'Apto',
  warn: 'Restricción',
  block: 'Bloqueo',
};
