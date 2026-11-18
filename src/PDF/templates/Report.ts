import { PDFDocument, StandardFonts } from 'pdf-lib';
import { blocks } from '@/PDF/blocks';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { InformedConsentRepository } from '@/Repositories/InformedConsentRepository';
import { loadSessionEntities } from '@/PDF/sessionEntities';
import { getUiLang } from '@/I18n/uiLang';
import { CATALOGUES } from '@/I18n/catalog';
import { evaluateSessionNlg, type NlgReportSynthesis, type RuleCategory } from '@/PDF/nlgReportEngine';
import { installWinAnsiFallback } from '@/PDF/winAnsiFallback';
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

/**
 * Aviso de la portada cuando el consentimiento no se puede leer o no existe.
 * Texto aprobado por Frank el 17/11/2026. Antes la línea se omitía sin decir
 * nada y el error iba solo a `console.warn`: un informe podía salir sin
 * constancia del consentimiento y sin que nadie se enterara (regla 4). El
 * informe se sigue pudiendo exportar y finalizar: lo decide el profesional.
 */
export const CONSENT_UNREADABLE_TEXT =
  'No se ha podido leer el consentimiento informado de esta evaluación. Compruébelo antes de firmar el informe.';

type ConsentRow = Awaited<ReturnType<typeof InformedConsentRepository.getLatestByEvaluation>>;

/** Línea de la portada sobre el consentimiento. Nunca lanza. */
export async function consentCoverText(
  read: () => Promise<ConsentRow>,
): Promise<{ text: string; missing: boolean }> {
  let consent: ConsentRow = null;
  try {
    consent = await read();
  } catch (e) {
    console.warn('VIA+: no se pudo leer el consentimiento para el informe', e);
  }
  if (!consent) return { text: CONSENT_UNREADABLE_TEXT, missing: true };
  const signed = new Date(consent.signedAt);
  const dateStr = `${String(signed.getDate()).padStart(2, '0')}-${String(signed.getMonth() + 1).padStart(2, '0')}-${signed.getFullYear()}`;
  const signerRole =
    consent.signerType === 'patient'
      ? 'el propio paciente'
      : consent.signerType === 'guardian'
        ? `su ${consent.signerRelation || 'tutor/a legal'}`
        : `su ${consent.signerRelation || 'representante'} (${consent.incapacityReason || 'incapacidad para firmar'})`;
  return {
    text: `Consentimiento informado v${consent.consentVersion} firmado el ${dateStr} por ${consent.signerName}, ${signerRole}.`,
    missing: false,
  };
}

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
  /** El mismo PDF en base64, para escribirlo a fichero (`@/PDF/reportFile`). */
  base64: string;
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
  // Antes de dibujar nada: «≤», «≥», «₂»… no tumban el PDF (ver el módulo).
  installWinAnsiFallback();
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
  const consentLine = await consentCoverText(() => InformedConsentRepository.getLatestByEvaluation(evaluation.id));
  cover.drawText(consentLine.text, {
    x: 48,
    y: cover.getSize().height - 135,
    size: 10,
    font: consentLine.missing ? fonts.semiBold : fonts.regular,
    maxWidth: cover.getSize().width - 96,
    lineHeight: 14,
  });

  // Síntesis y trazabilidad, después de la portada y antes del primer módulo.
  // Las reglas se calculan en esta lectura. Notas y firma no reescriben un
  // hecho; se archivan con la síntesis en `nlg_report_snapshot` al final.
  let synthesis: NlgReportSynthesis | null = null;
  // Una sola lectura para la síntesis Y para las páginas de módulo (A3): antes
  // eran dos lecturas que podían no coincidir. Si falla, el PDF no se genera y
  // la pantalla muestra el error de exportación: un informe firmado no puede
  // salir con páginas que no casan con su síntesis.
  const session = await loadSessionEntities(evaluation.id);
  const nlgReadFailed = false;
  synthesis = evaluateSessionNlg(session, getUiLang());

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

  for (const assessment of session.clinicalAssessments) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.ClinicalAssessmentDetail({ assessment }, { page, fonts, t });
  }

  for (const screening of session.screenings) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.ScreeningDetail({ screening }, { page, fonts, t });
  }

  for (const test of session.audiometries) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...test, interpretation: moduleInterpretation(synthesis, 'audiometry', test.id, test.interpretation) };
    await blocks.AudiometryDetail({ test: shown as typeof test }, { page, fonts, t });
  }

  for (const test of session.verbalAudiometries) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...test, interpretation: moduleInterpretation(synthesis, 'verbal', test.id, test.interpretation) };
    await blocks.VerbalAudiometryDetail({ test: shown as typeof test }, { page, fonts, t });
  }

  for (const analysis of session.voiceAnalyses) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...analysis, interpretation: moduleInterpretation(synthesis, 'voice', analysis.id, analysis.interpretation) };
    await blocks.VoiceAnalysisDetail({ analysis: shown as typeof analysis }, { page, fonts, t });
  }

  // Prosodia justo después del análisis de voz: los dos miden sobre la señal
  // acústica y se leen juntos (calidad de la fonación y dinámica del habla).
  for (const analysis of session.prosodyAnalyses) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...analysis, interpretation: moduleInterpretation(synthesis, 'prosody', analysis.id, analysis.interpretation) };
    await blocks.ProsodyDetail({ analysis: shown as typeof analysis }, { page, fonts, t });
  }

  for (const test of session.executiveFunctions) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...test, interpretation: moduleInterpretation(synthesis, 'executive', test.id, test.interpretation) };
    await blocks.ExecutiveFunctionsDetail({ test: shown as typeof test }, { page, fonts, t });
  }

  for (const test of session.dysphagias) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    const shown = { ...test, interpretation: moduleInterpretation(synthesis, 'dysphagia', test.id, test.interpretation) };
    await blocks.DysphagiaDetail({ test: shown as typeof test }, { page, fonts, t });
  }

  for (const screening of session.sahsScreenings) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.SahsScreeningDetail({ screening }, { page, fonts, t });
  }

  for (const test of session.articulations) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.ArticulationDetail({ test }, { page, fonts, t });
  }

  for (const test of session.ashaTests) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    await blocks.AshaScreeningDetail({ test }, { page, fonts, t });
  }

  const bytes = await pdfDoc.save();
  const base64 = await pdfDoc.saveAsBase64();

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

  return { bytes, base64, snapshotSaved, snapshotError };
}
