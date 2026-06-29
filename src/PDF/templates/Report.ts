import { PDFDocument, StandardFonts } from 'pdf-lib';
import { blocks } from '@/PDF/blocks';
import { Evaluation } from '@/Models/Evaluation/Evaluation';

/* -------------------------------------------------------------------------- */
/*  Generador de informe PDF — VIA+.                                        */
/*  Esqueleto mínimo: crea el documento, la portada y recorre `blocks`        */
/*  (vacío en Fase 1). Las fases de integración de módulo añaden, por cada    */
/*  resultado de su repositorio asociado a la evaluación, una página         */
/*  dibujada con su bloque correspondiente (ver Contrato de Compilación §6.5  */
/*  y el ejemplo de uso en `code/LEEME.md`).                                 */
/* -------------------------------------------------------------------------- */

export interface GenerateReportOptions {
  evaluation: Evaluation;
}

const PAGE_SIZE: [number, number] = [595, 842]; // A4 @ 72dpi

export async function generateReport({ evaluation }: GenerateReportOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    semiBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const t = (_key: string, fallback: string) => fallback;

  const cover = pdfDoc.addPage(PAGE_SIZE);
  cover.drawText('VIA+ — Informe de evaluación', {
    x: 48,
    y: cover.getSize().height - 80,
    size: 20,
    font: fonts.semiBold,
  });
  cover.drawText(`Evaluación #${evaluation.id}`, {
    x: 48,
    y: cover.getSize().height - 110,
    size: 12,
    font: fonts.regular,
  });

  // Module-specific report sections appended by later phases:
  //
  //   const tests = await AudiometryRepository.getAudiometryByEvaluation(evaluation.id);
  //   for (const test of tests) {
  //     const page = pdfDoc.addPage(PAGE_SIZE);
  //     await blocks.AudiometryDetail({ test }, { page, fonts, t });
  //   }
  void blocks;

  return pdfDoc.save();
}
