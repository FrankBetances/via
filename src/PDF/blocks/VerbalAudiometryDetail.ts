import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { BAND_LABEL, LEVEL_LABEL, MODALITY_LABEL, VERBAL_LANG_LABEL } from '@/Screens/VerbalAudiometry/verbalAudiometryResult';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface VerbalAudiometryDetailProps {
  test: VerbalAudiometryTest;
}

/**
 * Página de detalle de una audiometría verbal en campo libre dentro del
 * informe PDF: banda/modalidad, tabla nivel → % (aciertos/total), URV,
 * interpretación, notas y evaluador. Mismo estilo que AudiometryDetail.
 */
export async function VerbalAudiometryDetail(
  { test }: VerbalAudiometryDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let y = height - PDF_MARGINS.top;

  // Título
  page.drawText(t('PDF.VERBAL_AUDIOMETRY.TITLE', 'Audiometría verbal'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 26;
  // La variante lingüística (banco/voz es-DO) se hace constar en el subtítulo:
  // condiciona la comparabilidad del resultado entre informes.
  const langSuffix =
    test.language && test.language !== 'es'
      ? ` · ${VERBAL_LANG_LABEL[test.language] ?? test.language}`
      : '';
  page.drawText(
    `Reconocimiento por tarjetas · campo libre (binaural, sin audífonos) · ${BAND_LABEL[test.ageBand] ?? test.ageBand} · ${
      MODALITY_LABEL[test.modality] ?? test.modality
    }${langSuffix}`,
    { x: PDF_MARGINS.left, y, size: PDF_FONT_SIZES.md, font: fonts.regular, color: PDF_COLORS.trueGray500 },
  );
  y -= 34;

  // Tabla nivel → % de discriminación
  const colX = [PDF_MARGINS.left, PDF_MARGINS.left + 190, PDF_MARGINS.left + 330];
  page.drawText('Nivel', { x: colX[0], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  page.drawText('Discriminación', { x: colX[1], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  page.drawText('Aciertos', { x: colX[2], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  y -= 22;

  const levelScores = test.levelScores ?? [];
  if (levelScores.length === 0) {
    page.drawText('—', { x: colX[0], y, size: PDF_FONT_SIZES.md, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    y -= 20;
  }
  for (const ls of levelScores) {
    const label = LEVEL_LABEL[ls.level] ? `${ls.level} dB (${LEVEL_LABEL[ls.level]})` : `${ls.level} dB`;
    page.drawText(label, { x: colX[0], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
    page.drawText(`${ls.pct} %`, { x: colX[1], y, size: PDF_FONT_SIZES.md, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    page.drawText(`${ls.correct}/${ls.presented}`, { x: colX[2], y, size: PDF_FONT_SIZES.md, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    y -= 20;
  }

  y -= 14;

  // Resumen: discriminación principal + URV + fiabilidad
  const reliabilityStr = test.reliability !== null && test.reliability !== undefined ? `${test.reliability}%` : '—';
  const srtStr = test.srtDb !== null && test.srtDb !== undefined ? `≈ ${test.srtDb} dB` : '—';
  page.drawText(
    `Discriminación: ${test.discriminationPct}%    ·    URV: ${srtStr}    ·    Fiabilidad: ${reliabilityStr}`,
    { x: PDF_MARGINS.left, y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 },
  );
  y -= 30;

  // Interpretación
  page.drawText(t('PDF.VERBAL_AUDIOMETRY.INTERPRETATION', 'Interpretación'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 22;
  page.drawText(test.interpretation || '-', {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
    lineHeight: PDF_FONT_SIZES.md * 1.4,
  });
  y -= 70;

  if (test.notes) {
    page.drawText(test.notes, {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.md * 1.4,
    });
    y -= 44;
  }

  // Evaluador + fecha
  const completed = test.completedAt ? new Date(test.completedAt) : null;
  const dateStr = completed
    ? `${String(completed.getDate()).padStart(2, '0')}-${String(completed.getMonth() + 1).padStart(2, '0')}-${String(
        completed.getFullYear(),
      ).slice(2)}`
    : '-';
  page.drawText(`Evaluador: ${test.evaluatorName} (${test.evaluatorLicense}) · ${dateStr}`, {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.sm,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
  });

  await Logo({ page, fonts, t });
}
