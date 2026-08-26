/* -------------------------------------------------------------------------- */
/*  Catálogo Clínico de Hitos del Desarrollo ASHA (0 a 5 años).                */
/*  Basado en normas de desarrollo de la American Speech-Language-Hearing      */
/*  Association (ASHA) con umbrales de adquisición en el Percentil 75.        */
/*  Regla Inviolable: Cero llamadas a red, determinista y local.               */
/* -------------------------------------------------------------------------- */

export type AshaDomain = 'receptive' | 'expressive' | 'pragmatic';

export type AshaAgeBand =
  | '0-6m'
  | '7-12m'
  | '13-18m'
  | '19-24m'
  | '2-3y'
  | '3-4y'
  | '4-5y';

export interface AshaMilestone {
  id: string;
  ageBand: AshaAgeBand;
  domain: AshaDomain;
  text: string;
  description?: string;
  /** Bandera roja clínica: su no cumplimiento determina riesgo Alto (ROJO) */
  isRedFlag: boolean;
}

export interface AgeBandSpec {
  id: AshaAgeBand;
  label: string;
  minMonths: number;
  maxMonths: number;
  description: string;
}

export const ASHA_AGE_BANDS: AgeBandSpec[] = [
  { id: '0-6m', label: '0 a 6 meses', minMonths: 0, maxMonths: 6, description: 'Pre-lingüístico temprano y alerta acústica' },
  { id: '7-12m', label: '7 a 12 meses', minMonths: 7, maxMonths: 12, description: 'Balbuceo canónico y gestos comunicativos' },
  { id: '13-18m', label: '13 a 18 meses', minMonths: 13, maxMonths: 18, description: 'Primeras palabras y atención conjunta' },
  { id: '19-24m', label: '19 a 24 meses', minMonths: 19, maxMonths: 24, description: 'Combinación de palabras y seguimiento verbal' },
  { id: '2-3y', label: '2 a 3 años', minMonths: 24, maxMonths: 36, description: 'Frases simples, vocabulario y juego simbólico' },
  { id: '3-4y', label: '3 a 4 años', minMonths: 36, maxMonths: 48, description: 'Oraciones complejas y relato de vivencias' },
  { id: '4-5y', label: '4 a 5 años', minMonths: 48, maxMonths: 60, description: 'Discurso narrativo, inteligibilidad y pragmática social' },
];

export const ASHA_DOMAIN_META: Record<AshaDomain, { label: string; description: string; color: string }> = {
  receptive: {
    label: 'Lenguaje Receptivo',
    description: 'Comprensión auditivo-verbal, discriminación acústica y seguimiento de órdenes.',
    color: '#0D9488',
  },
  expressive: {
    label: 'Lenguaje Expresivo',
    description: 'Fonología, vocabulario, morfología, sintaxis y estructura del habla.',
    color: '#FF7F00',
  },
  pragmatic: {
    label: 'Comunicación Pragmática',
    description: 'Uso social del lenguaje, contacto ocular, turnos conversacionales e intención comunicativa.',
    color: '#7C3AED',
  },
};

/**
 * Catálogo estructurado de hitos representativos (0-5 años) con banderas rojas.
 */
export const ASHA_MILESTONES: AshaMilestone[] = [
  // ─── 0 a 6 meses ─────────────────────────────────────────────────────────
  {
    id: 'asha_0_6_rec_1',
    ageBand: '0-6m',
    domain: 'receptive',
    text: 'Reacciona a sonidos fuertes y se tranquiliza u orienta ante la voz familiar.',
    description: 'Sobresalto ante ruidos repentinos, parpadeo o giro de cabeza hacia la fuente sonora.',
    isRedFlag: false,
  },
  {
    id: 'asha_0_6_exp_1',
    ageBand: '0-6m',
    domain: 'expressive',
    text: 'Emite gorjeos, sonidos guturales placenteros y lloros diferenciados según necesidad.',
    description: 'Vocalizaciones reflejas y gorjeos ("agu", "a-a") en interacción cara a cara.',
    isRedFlag: false,
  },
  {
    id: 'asha_0_6_prag_1',
    ageBand: '0-6m',
    domain: 'pragmatic',
    text: 'Mantiene contacto ocular directo y responde con sonrisa social a los 3-4 meses.',
    description: 'Fijación visual mantenida y sonrisa responsiva en interacción afectiva con cuidadores.',
    isRedFlag: true, // Bandera roja: falta de sonrisa social / contacto visual a los 4-6m
  },

  // ─── 7 a 12 meses ────────────────────────────────────────────────────────
  {
    id: 'asha_7_12_rec_1',
    ageBand: '7-12m',
    domain: 'receptive',
    text: 'Responde consistentemente a su nombre girando la cabeza y comprende órdenes simples con gesto ("ven", "dame").',
    description: 'Reconocimiento del nombre propio a los 9-10m sin necesidad de pistas visuales.',
    isRedFlag: true, // Bandera roja: no responder a su nombre a los 12m
  },
  {
    id: 'asha_7_12_exp_1',
    ageBand: '7-12m',
    domain: 'expressive',
    text: 'Produce balbuceo canónico repetitivo y variado con consonantes ("ba-ba", "ma-ma", "da-da") a los 12 meses.',
    description: 'Cadenas silábicas bien formadas con entonación variada.',
    isRedFlag: true, // Bandera roja explícita: ausencia de balbuceo a los 12m
  },
  {
    id: 'asha_7_12_prag_1',
    ageBand: '7-12m',
    domain: 'pragmatic',
    text: 'Utiliza gestos comunicativos intencionales (señalar con el dedo para pedir o mostrar, decir adiós con la mano).',
    description: 'Protoimperativos y protodeclarativos claros con intención compartida a los 12m.',
    isRedFlag: true, // Bandera roja: no señalar ni hacer gestos comunicativos a los 12m
  },

  // ─── 13 a 18 meses ───────────────────────────────────────────────────────
  {
    id: 'asha_13_18_rec_1',
    ageBand: '13-18m',
    domain: 'receptive',
    text: 'Identifica objetos cotidianos o partes del cuerpo cuando se le nombran ("¿dónde está la pelota?", "¿y tu nariz?").',
    description: 'Comprensión de al menos 20-50 palabras familiares y señalización receptiva.',
    isRedFlag: false,
  },
  {
    id: 'asha_13_18_exp_1',
    ageBand: '13-18m',
    domain: 'expressive',
    text: 'Utiliza de forma consistente al menos 6 a 10 palabras con significado claro e imita palabras nuevas a los 18 meses.',
    description: 'Palabras funcionales (agua, papá, mamá, más, no, pan) con valor comunicativo.',
    isRedFlag: true, // Bandera roja: menos de 6 palabras a los 18m
  },
  {
    id: 'asha_13_18_prag_1',
    ageBand: '13-18m',
    domain: 'pragmatic',
    text: 'Muestra atención conjunta espontánea (mira un objeto y vuelve la mirada al adulto para compartir interés).',
    description: 'Triangulación de la mirada niño-objeto-adulto en situaciones de juego.',
    isRedFlag: true, // Bandera roja: ausencia de atención conjunta
  },

  // ─── 19 a 24 meses ───────────────────────────────────────────────────────
  {
    id: 'asha_19_24_rec_1',
    ageBand: '19-24m',
    domain: 'receptive',
    text: 'Comprende y ejecuta instrucciones sencillas de 2 pasos no relacionados ("coge el zapato y ponlo en la caja").',
    description: 'Seguimiento de consignas verbales sin requerir apoyo gestual constante.',
    isRedFlag: false,
  },
  {
    id: 'asha_19_24_exp_1',
    ageBand: '19-24m',
    domain: 'expressive',
    text: 'Combina espontáneamente dos o más palabras en frases de dos elementos ("más leche", "papá ven", "nene pan") a los 24 meses.',
    description: 'Estructuras de dos términos no ecolálicas ni aprendidas como fórmula fija.',
    isRedFlag: true, // Bandera roja explícita: ausencia de combinación de 2 palabras a los 24m
  },
  {
    id: 'asha_19_24_prag_1',
    ageBand: '19-24m',
    domain: 'pragmatic',
    text: 'Utiliza el lenguaje verbal o gestos para iniciar interacción, pedir ayuda o mostrar objetos a otros niños/adultos.',
    description: 'Búsqueda activa del otro con propósito interactivo.',
    isRedFlag: false,
  },

  // ─── 2 a 3 años ──────────────────────────────────────────────────────────
  {
    id: 'asha_2_3_rec_1',
    ageBand: '2-3y',
    domain: 'receptive',
    text: 'Comprende conceptos espaciales básicos (dentro/fuera, arriba/abajo, grande/pequeño) y preguntas simples (qué, quién, dónde).',
    description: 'Comprensión verbal ampliada sin apoyo contextual directo.',
    isRedFlag: false,
  },
  {
    id: 'asha_2_3_exp_1',
    ageBand: '2-3y',
    domain: 'expressive',
    text: 'Dispone de un vocabulario de mas de 50-100 palabras y su habla es comprendida por familiares en al menos un 75% y por interlocutores no familiares en al menos un 50%.',
    description: 'Frases de 3 palabras (Sujeto + Verbo + Objeto) con uso incipiente de artículos y plurales.',
    isRedFlag: true, // Bandera roja: < 50 palabras o habla completamente ininteligible a los 3 años
  },
  {
    id: 'asha_2_3_prag_1',
    ageBand: '2-3y',
    domain: 'pragmatic',
    text: 'Participa en turnos conversacionales breves y muestra juego simbólico elemental (hacer que come, dar de comer al muñeco).',
    description: 'Alternancia de turnos y simbolización lúdica compartida.',
    isRedFlag: false,
  },

  // ─── 3 a 4 años ──────────────────────────────────────────────────────────
  {
    id: 'asha_3_4_rec_1',
    ageBand: '3-4y',
    domain: 'receptive',
    text: 'Responde a preguntas de causa-efecto ("¿por qué?") y comprende órdenes complejas de 3 pasos consecutivos.',
    description: 'Comprensión de relaciones causales y secuencias orales extensas.',
    isRedFlag: false,
  },
  {
    id: 'asha_3_4_exp_1',
    ageBand: '3-4y',
    domain: 'expressive',
    text: 'Relata sucesos sencillos de su día a día con oraciones estructuradas de 4 o más palabras usando pronombres y preposiciones.',
    description: 'Habla comprensible en un 75-80% por personas desconocidas.',
    isRedFlag: false,
  },
  {
    id: 'asha_3_4_prag_1',
    ageBand: '3-4y',
    domain: 'pragmatic',
    text: 'Inicia y mantiene conversaciones sobre temas de su interés, respetando normas sociales básicas (saludar, despedirse, pedir por favor).',
    description: 'Ajuste comunicativo pragmático en el entorno escolar/familiar.',
    isRedFlag: false,
  },

  // ─── 4 a 5 años ──────────────────────────────────────────────────────────
  {
    id: 'asha_4_5_rec_1',
    ageBand: '4-5y',
    domain: 'receptive',
    text: 'Comprende narraciones de cuentos, relaciones temporales (antes/después, ayer/mañana) y preguntas de inferencia.',
    description: 'Procesamiento de discursos elaborados y vocabulario abstracto.',
    isRedFlag: false,
  },
  {
    id: 'asha_4_5_exp_1',
    ageBand: '4-5y',
    domain: 'expressive',
    text: 'Habla con inteligibilidad casi completa (90-100%), estructura gramatical correcta y narra historias completas con inicio, desarrollo y final.',
    description: 'Articulación de la mayoría de fonemas del español y construcción sintáctica compleja.',
    isRedFlag: false,
  },
  {
    id: 'asha_4_5_prag_1',
    ageBand: '4-5y',
    domain: 'pragmatic',
    text: 'Emplea el lenguaje para negociar, resolver disputas entre pares, cooperar en juegos reglados y hacer preguntas explicativas.',
    description: 'Habilidades pragmáticas avanzadas y empatía conversacional.',
    isRedFlag: false,
  },
];

/** Obtiene los hitos correspondientes a una banda de edad específica */
export function getMilestonesForAgeBand(ageBand: AshaAgeBand): AshaMilestone[] {
  return ASHA_MILESTONES.filter(m => m.ageBand === ageBand);
}

/** Determina la banda de edad adecuada a partir de los meses de vida del paciente */
export function resolveAgeBandFromMonths(months: number): AshaAgeBand {
  if (months <= 6) return '0-6m';
  if (months <= 12) return '7-12m';
  if (months <= 18) return '13-18m';
  if (months <= 24) return '19-24m';
  if (months <= 36) return '2-3y';
  if (months <= 48) return '3-4y';
  return '4-5y';
}
