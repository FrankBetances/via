import type { PDFFont, PDFPage } from 'pdf-lib';

/* -------------------------------------------------------------------------- */
/*  Tipos compartidos de los bloques PDF — VIA+.                            */
/*  `BlockOptions` es el nombre que usan los paquetes `*(React Native)`       */
/*  (`../types`); se mantiene como alias de `PdfBlockOptions` para poder      */
/*  copiar los bloques de cada módulo sin reescribir sus imports relativos.   */
/* -------------------------------------------------------------------------- */

export interface PdfFonts {
  regular: PDFFont;
  semiBold: PDFFont;
  bold: PDFFont;
}

export interface PdfBlockOptions {
  page: PDFPage;
  fonts: PdfFonts;
  /**
   * Traductor de claves de informe. Admite un `fallback` de texto simple o un
   * objeto de variables (algunos bloques de módulo lo usan como
   * `t('PDF.X.EVALUATOR', { name, license, date })`); en ambos casos, al no
   * existir traducción real todavía, se devuelve `null` y el bloque cae a su
   * literal `... || 'Evaluador: ...'` en español.
   */
  t: (key: string, fallback?: string | Record<string, unknown>) => string;
}

// Alias usado por los paquetes de módulo (`import { BlockOptions } from '../types'`).
export type BlockOptions = PdfBlockOptions;

export type PdfBlock<TProps> = (props: TProps, options: PdfBlockOptions) => Promise<void>;
