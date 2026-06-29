/* -------------------------------------------------------------------------- */
/*  Registro central de bloques PDF — VIA+.                                 */
/*  Cada módulo clínico aporta un bloque de detalle (función async que        */
/*  dibuja una página de pdf-lib) registrado aquí bajo su clave. Fase 1 lo     */
/*  deja vacío; las fases de integración de módulo añaden una entrada por     */
/*  cada bloque (`ClinicalAssessmentDetail`, `ScreeningDetail`,               */
/*  `AudiometryDetail`, `VoiceAnalysisDetail`, `DysphagiaDetail`,             */
/*  `SahsScreeningDetail`, `ArticulationDetail`, ...), ver Contrato de         */
/*  Compilación §6.5.                                                        */
/* -------------------------------------------------------------------------- */

import type { PDFFont, PDFPage } from 'pdf-lib';

export interface PdfFonts {
  regular: PDFFont;
  semiBold: PDFFont;
}

export interface PdfBlockOptions {
  page: PDFPage;
  fonts: PdfFonts;
  t: (key: string, fallback: string) => string;
}

export type PdfBlock<TProps> = (props: TProps, options: PdfBlockOptions) => Promise<void>;

/**
 * Registro de bloques de informe por módulo. Las fases posteriores añaden
 * una entrada por bloque, p.ej.:
 *   blocks.AudiometryDetail = AudiometryDetail;
 */
export const blocks: Record<string, PdfBlock<any>> = {
  // Module-specific PDF blocks appended by later phases
};
