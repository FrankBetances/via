/* -------------------------------------------------------------------------- */
/*  Tono clínico: colores con SIGNIFICADO fijo para el modo profesional.       */
/*                                                                            */
/*  Un color de estado no se elige por estética en cada pantalla: el ámbar    */
/*  de «revisar» tiene que ser el mismo en Resultados, en el Historial y en   */
/*  la síntesis, o el profesional aprende tres códigos. Las ETIQUETAS no      */
/*  viven aquí, viven en el catálogo (`nlg.ui.status*`): hasta el 2/11/2026   */
/*  estas insignias decían «Normal», en castellano fijo y con el término que  */
/*  el producto no usa para clasificar al niño.                               */
/*                                                                            */
/*  Contraste: cada `fg` sobre su `bg` supera 4,5:1 (WCAG AA, texto normal),  */
/*  calculado con la fórmula de luminancia relativa de WCAG 2.1.              */
/* -------------------------------------------------------------------------- */

export interface Tone {
  /** Texto e icono. */
  fg: string;
  /** Fondo de la insignia o de la fila. */
  bg: string;
  /** Barra lateral o borde que marca la fila. */
  bar: string;
}

/** Estado de una prueba (semáforo de las tarjetas). */
export type StatusTone = 'ok' | 'warn' | 'alt';

export const STATUS_TONE: Record<StatusTone, Tone> = {
  ok: { fg: '#047857', bg: '#ECFDF5', bar: '#10B981' },
  warn: { fg: '#92400E', bg: '#FEF3C7', bar: '#D97706' },
  alt: { fg: '#B91C1C', bg: '#FEE2E2', bar: '#DC2626' },
};

/** Tipo de frase de la síntesis NLG. */
export type FactTone = 'info' | 'warning' | 'referral' | 'cross';

export const FACT_TONE: Record<FactTone, Tone> = {
  info: { fg: '#334155', bg: '#FFFFFF', bar: '#CBD5E1' },
  warning: { fg: '#92400E', bg: '#FFFBEB', bar: '#D97706' },
  referral: { fg: '#B91C1C', bg: '#FEF2F2', bar: '#DC2626' },
  cross: { fg: '#1E40AF', bg: '#EFF6FF', bar: '#2563EB' },
};

/** Tono de un hecho: la derivación manda sobre el aviso, y el cruce sobre todo. */
export const factTone = (fact: { category: string; level: string; referral: boolean }): FactTone => {
  if (fact.referral) return 'referral';
  if (fact.category === 'cross') return 'cross';
  return fact.level === 'warning' ? 'warning' : 'info';
};
