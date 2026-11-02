import { PDFDocument, StandardFonts } from 'pdf-lib';
import { blocks } from '@/PDF/blocks';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { InformedConsentRepository } from '@/Repositories/InformedConsentRepository';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { AshaMilestoneTestRepository } from '@/Repositories/AshaMilestoneTestRepository';
import { getUiLang } from '@/I18n/uiLang';
import { CATALOGUES } from '@/I18n/catalog';
import { evaluateSessionNlg, type NlgReportSynthesis, type RuleCategory } from '@/PDF/nlgReportEngine';
import { NlgReportSnapshot } from '@/Models/NlgReportSnapshot/NlgReportSnapshot';
import { NlgReportSnapshotRepository } from '@/Repositories/NlgReportSnapshotRepository';

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
  /** Texto libre del clínico. No sustituye un ClinicalFact. Solo este PDF. */
  customSynthesisNotes?: string;
  /** Path SVG de SignaturePad. null = sin firma. Se archiva en la instantánea. */
  clinicianSignatureSvg?: string | null;
}

/**
 * El PDF y si quedó archivada la síntesis que lleva. `snapshotSaved: false`
 * no impide entregar el PDF, pero la pantalla TIENE que decirlo (regla 4):
 * un informe firmado sin constancia de lo firmado no es lo mismo que uno con.
 */
export interface GeneratedReport {
  bytes: Uint8Array;
  snapshotSaved: boolean;
  snapshotError: string | null;
}

/**
 * Texto de interpretación de una página de módulo: los hechos del motor para
 * ESA fila, los mismos que la síntesis. Antes la página imprimía el campo
 * `interpretation` guardado al hacer la prueba, y en una sesión antigua el
 * mismo PDF llevaba la frase vieja («rangos normativos») y la nueva. Solo si
 * la síntesis no se pudo calcular se cae al texto guardado.
 */
const moduleInterpretation = (
  synthesis: NlgReportSynthesis | null,
  category: RuleCategory,
  id: number,
  stored: string,
): string => {
  if (!synthesis || synthesis.unavailableReason) return stored;
  const text = synthesis.facts
    .filter(f => f.category === category && f.measured.id === id)
    .map(f => f.text)
    .join(' ');
  return text || stored;
};

const PAGE_SIZE: [number, number] = [595, 842]; // A4 @ 72dpi

export async function generateReport({
  evaluation,
  customSynthesisNotes,
  clinicianSignatureSvg,
}: GenerateReportOptions): Promise<GeneratedReport> {
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

  // Síntesis y trazabilidad, después de la portada y antes del primer módulo.
  // Las reglas se calculan en esta lectura. Notas y firma no reescriben un
  // hecho; se archivan con la síntesis en `nlg_report_snapshot` al final.
  let synthesis: NlgReportSynthesis | null = null;
  let nlgReadFailed = false;
  try {
    const [
      clinicalAssessments,
      screenings,
      audiometries,
      verbalAudiometries,
      voiceAnalyses,
      prosodyAnalyses,
      executiveFunctions,
      dysphagias,
      sahsScreenings,
      articulations,
      ashaTests,
    ] = await Promise.all([
      ClinicalAssessmentRepository.getClinicalAssessmentsByEvaluation(evaluation.id),
      ScreeningRepository.getScreeningsByEvaluation(evaluation.id),
      AudiometryRepository.getAudiometryByEvaluation(evaluation.id),
      VerbalAudiometryRepository.getVerbalAudiometryByEvaluation(evaluation.id),
      VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluation.id),
      ProsodyAnalysisRepository.getProsodyAnalysisByEvaluation(evaluation.id),
      ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(evaluation.id),
      DysphagiaTestRepository.getDysphagiaByEvaluation(evaluation.id),
      SahsScreeningRepository.getSahsScreeningsByEvaluation(evaluation.id),
      ArticulationTestRepository.getArticulationByEvaluation(evaluation.id),
      AshaMilestoneTestRepository.getAshaTestsByEvaluation(evaluation.id),
    ]);
    synthesis = evaluateSessionNlg(
      {
        clinicalAssessments,
        screenings,
        audiometries,
        verbalAudiometries,
        voiceAnalyses,
        prosodyAnalyses,
        executiveFunctions,
        dysphagias,
        sahsScreenings,
        articulations,
        ashaTests,
      },
      getUiLang(),
    );
  } catch (e) {
    nlgReadFailed = true;
    synthesis = null;
    console.warn('VIA+: no se pudo leer la sesión para la síntesis NLG', e);
  }

  const synthesisPage = pdfDoc.addPage(PAGE_SIZE);
  await blocks.NlgClinicalSynthesis(
    {
      synthesis,
      notes: customSynthesisNotes,
      signatureSvg: clinicianSignatureSvg,
      readFailed: nlgReadFailed,
    },
    { page: synthesisPage, fonts, t },
  );
  const auditPage = pdfDoc.addPage(PAGE_SIZE);
  await blocks.NlgAuditTrail({ synthesis, readFailed: nlgReadFailed }, { page: auditPage, fonts, t });

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
    const shown = { ...test, interpretation: moduleInterpretation(synthesis, 'audiometry', test.id, test.interpretation) };
    await blocks.AudiometryDetail({ test: shown as typeof test }, { page, fonts, t });
  }

  const verbalAudiometries = await VerbalAudiometryRepository.getVerbalAudiometryByEvaluation(evaluation.id);
  for (const test of verbalAudiometries) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...test, interpretation: moduleInterpretation(synthesis, 'verbal', test.id, test.interpretation) };
    await blocks.VerbalAudiometryDetail({ test: shown as typeof test }, { page, fonts, t });
  }

  const voiceAnalyses = await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluation.id);
  for (const analysis of voiceAnalyses) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...analysis, interpretation: moduleInterpretation(synthesis, 'voice', analysis.id, analysis.interpretation) };
    await blocks.VoiceAnalysisDetail({ analysis: shown as typeof analysis }, { page, fonts, t });
  }

  // Prosodia justo después del análisis de voz: los dos miden sobre la señal
  // acústica y se leen juntos (calidad de la fonación y dinámica del habla).
  const prosodyAnalyses = await ProsodyAnalysisRepository.getProsodyAnalysisByEvaluation(evaluation.id);
  for (const analysis of prosodyAnalyses) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...analysis, interpretation: moduleInterpretation(synthesis, 'prosody', analysis.id, analysis.interpretation) };
    await blocks.ProsodyDetail({ analysis: shown as typeof analysis }, { page, fonts, t });
  }

  const executiveFunctions = await ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(evaluation.id);
  for (const test of executiveFunctions) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...test, interpretation: moduleInterpretation(synthesis, 'executive', test.id, test.interpretation) };
    await blocks.ExecutiveFunctionsDetail({ test: shown as typeof test }, { page, fonts, t });
  }

  const dysphagias = await DysphagiaTestRepository.getDysphagiaByEvaluation(evaluation.id);
  for (const test of dysphagias) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...test, interpretation: moduleInterpretation(synthesis, 'dysphagia', test.id, test.interpretation) };
    await blocks.DysphagiaDetail({ test: shown as typeof test }, { page, fonts, t });
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

  const ashaTests = await AshaMilestoneTestRepository.getAshaTestsByEvaluation(evaluation.id);
  for (const test of ashaTests) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.AshaScreeningDetail({ test }, { page, fonts, t });
  }

  const bytes = await pdfDoc.save();

  // Constancia de lo firmado: texto exacto, reglas, versión, notas y firma.
  let snapshotSaved = false;
  let snapshotError: string | null = null;
  try {
    const snap = new NlgReportSnapshot();
    snap.evaluationId = evaluation.id;
    snap.lang = synthesis?.lang ?? getUiLang();
    snap.evidenceVersion = synthesis && !synthesis.unavailableReason ? CATALOGUES[snap.lang as keyof typeof CATALOGUES]?.nlg?.audit?.evidenceVersion ?? '' : '';
    snap.status = nlgReadFailed ? 'read-failed' : synthesis?.unavailableReason ?? 'ok';
    snap.ruleIds = synthesis?.ruleIds ?? [];
    snap.facts = (synthesis?.facts ?? []).map(f => ({
      ruleId: f.ruleId,
      level: f.level,
      text: f.text,
      measured: f.measured,
    }));
    snap.formattedReportText = synthesis?.formattedReportText ?? '';
    snap.clinicianNotes = customSynthesisNotes?.trim() ?? '';
    snap.clinicianSignatureSvg = clinicianSignatureSvg ?? null;
    // La pantalla pasa la evaluación del store (`professional.name`), no la
    // entidad (`professional.fullName`): se aceptan las dos formas.
    const pro = evaluation.professional as unknown as
      | { fullName?: string; name?: string; licenseNumber?: string }
      | null
      | undefined;
    snap.professionalName = pro?.fullName ?? pro?.name ?? '';
    snap.professionalLicense = pro?.licenseNumber ?? '';
    await NlgReportSnapshotRepository.insertSnapshot(snap);
    snapshotSaved = true;
  } catch (e) {
    snapshotError = e instanceof Error ? e.message : String(e);
  }

  return { bytes, snapshotSaved, snapshotError };
}
