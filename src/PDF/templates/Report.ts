import { PDFDocument, StandardFonts } from 'pdf-lib';
import { blocks } from '@/PDF/blocks';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { InformedConsentRepository } from '@/Repositories/InformedConsentRepository';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';

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
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const t = (_key: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : _key;

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

  // Constancia del consentimiento informado (trazabilidad legal del informe).
  try {
    const consent = await InformedConsentRepository.getLatestByEvaluation(evaluation.id);
    if (consent) {
      const signed = new Date(consent.signedAt);
      const dateStr = `${String(signed.getDate()).padStart(2, '0')}-${String(signed.getMonth() + 1).padStart(2, '0')}-${signed.getFullYear()}`;
      const signerRole =
        consent.signerType === 'patient'
          ? 'el propio paciente'
          : consent.signerType === 'guardian'
            ? `su ${consent.signerRelation || 'tutor/a legal'}`
            : `su ${consent.signerRelation || 'representante'} (${consent.incapacityReason || 'incapacidad para firmar'})`;
      cover.drawText(
        `Consentimiento informado v${consent.consentVersion} firmado el ${dateStr} por ${consent.signerName}, ${signerRole}.`,
        {
          x: 48,
          y: cover.getSize().height - 135,
          size: 10,
          font: fonts.regular,
          maxWidth: cover.getSize().width - 96,
          lineHeight: 14,
        },
      );
    }
  } catch (e) {
    // El informe no debe fallar por no poder leer el consentimiento.
    console.warn('VIA+: no se pudo incluir el consentimiento en el informe', e);
  }

  // Module-specific report sections: una página por resultado de módulo
  // asociado a la evaluación, en el orden del Contrato de Compilación §2.

  const clinicalAssessments = await ClinicalAssessmentRepository.getClinicalAssessmentsByEvaluation(evaluation.id);
  for (const assessment of clinicalAssessments) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.ClinicalAssessmentDetail({ assessment }, { page, fonts, t });
  }

  const screenings = await ScreeningRepository.getScreeningsByEvaluation(evaluation.id);
  for (const screening of screenings) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.ScreeningDetail({ screening }, { page, fonts, t });
  }

  const audiometries = await AudiometryRepository.getAudiometryByEvaluation(evaluation.id);
  for (const test of audiometries) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.AudiometryDetail({ test }, { page, fonts, t });
  }

  const voiceAnalyses = await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluation.id);
  for (const analysis of voiceAnalyses) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.VoiceAnalysisDetail({ analysis }, { page, fonts, t });
  }

  const dysphagias = await DysphagiaTestRepository.getDysphagiaByEvaluation(evaluation.id);
  for (const test of dysphagias) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.DysphagiaDetail({ test }, { page, fonts, t });
  }

  const sahsScreenings = await SahsScreeningRepository.getSahsScreeningsByEvaluation(evaluation.id);
  for (const screening of sahsScreenings) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.SahsScreeningDetail({ screening }, { page, fonts, t });
  }

  const articulations = await ArticulationTestRepository.getArticulationByEvaluation(evaluation.id);
  for (const test of articulations) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.ArticulationDetail({ test }, { page, fonts, t });
  }

  return pdfDoc.save();
}
