/* -------------------------------------------------------------------------- */
/*  Registro central de bloques PDF — VIA+.                                 */
/*  Cada módulo clínico aporta un bloque de detalle (función async que        */
/*  dibuja una página de pdf-lib) registrado aquí bajo su clave. Los 7        */
/*  bloques de módulo (`ClinicalAssessmentDetail`, `ScreeningDetail`,         */
/*  `AudiometryDetail`, `VoiceAnalysisDetail`, `DysphagiaDetail`,             */
/*  `SahsScreeningDetail`, `ArticulationDetail`) están registrados aquí y     */
/*  enganchados en `PDF/templates/Report.ts`, ver Contrato de Compilación     */
/*  §6.5.                                                                    */
/* -------------------------------------------------------------------------- */

export type { PdfFonts, PdfBlockOptions, PdfBlock, BlockOptions } from './types';
import type { PdfBlock } from './types';

export { ClinicalAssessmentDetail } from './ClinicalAssessmentDetail';
export { ScreeningDetail } from './ScreeningDetail';
export { AudiometryDetail } from './AudiometryDetail';
export { VoiceAnalysisDetail } from './VoiceAnalysisDetail';
export { ProsodyDetail } from './ProsodyDetail';
export { DysphagiaDetail } from './DysphagiaDetail';
export { SahsScreeningDetail } from './SahsScreeningDetail';
export { ArticulationDetail } from './ArticulationDetail';
export { VerbalAudiometryDetail } from './VerbalAudiometryDetail';
export { ExecutiveFunctionsDetail } from './ExecutiveFunctionsDetail';

import { ClinicalAssessmentDetail } from './ClinicalAssessmentDetail';
import { ScreeningDetail } from './ScreeningDetail';
import { AudiometryDetail } from './AudiometryDetail';
import { VoiceAnalysisDetail } from './VoiceAnalysisDetail';
import { ProsodyDetail } from './ProsodyDetail';
import { DysphagiaDetail } from './DysphagiaDetail';
import { SahsScreeningDetail } from './SahsScreeningDetail';
import { ArticulationDetail } from './ArticulationDetail';
import { VerbalAudiometryDetail } from './VerbalAudiometryDetail';
import { ExecutiveFunctionsDetail } from './ExecutiveFunctionsDetail';

/**
 * Registro de bloques de informe por módulo, recorrido por
 * `PDF/templates/Report.ts`.
 */
export const blocks: Record<string, PdfBlock<any>> = {
  ClinicalAssessmentDetail,
  ScreeningDetail,
  AudiometryDetail,
  VoiceAnalysisDetail,
  ProsodyDetail,
  DysphagiaDetail,
  SahsScreeningDetail,
  ArticulationDetail,
  VerbalAudiometryDetail,
  ExecutiveFunctionsDetail,
};
