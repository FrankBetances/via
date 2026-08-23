import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import {
  EF_BAND_LABEL,
  EF_DOMAIN_META,
  EF_DOMAIN_ORDER,
} from '@/Screens/ExecutiveFunctions/executiveFunctionsGame';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';
import { efLabelFromTest } from '@/Screens/ExecutiveFunctions/executiveFunctionsGame';

interface ExecutiveFunctionsDetailProps {
  test: ExecutiveFunctionsTest;
}

/**
 * Página de detalle de la exploración lúdica de funciones ejecutivas dentro
 * del informe PDF: banda de edad, tabla dominio → puntuación 0–100, índice
 * global, interpretación, notas y evaluador. Mismo estilo que
 * VerbalAudiometryDetail.
 */
export async function ExecutiveFunctionsDetail(
  { test }: ExecutiveFunctionsDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let y = height - PDF_MARGINS.top;

  // Título
  page.drawText(t('PDF.EXECUTIVE_FUNCTIONS.TITLE', 'Funciones ejecutivas'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 26;
  page.drawText(
    `Exploración lúdica por mini-juegos de tarjetas · ${EF_BAND_LABEL[test.ageBand] ?? test.ageBand}`,
    { x: PDF_MARGINS.left, y, size: PDF_FONT_SIZES.md, font: fonts.regular, color: PDF_COLORS.trueGray500 },
  );
  y -= 34;

  // Tabla dominio → puntuación
  const colX = [PDF_MARGINS.left, PDF_MARGINS.left + 220, PDF_MARGINS.left + 340];
  page.drawText('Dominio', { x: colX[0], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  page.drawText('Mini-juego', { x: colX[1], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  page.drawText('Puntuación', { x: colX[2], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  y -= 22;

  const domainScores: Record<string, number | null> = {
    attention: test.attentionScore,
    inhibition: test.inhibitionScore,
    flexibility: test.flexibilityScore,
    workingMemory: test.workingMemoryScore,
    planning: test.planningScore,
  };
  for (const domain of EF_DOMAIN_ORDER) {
    const meta = EF_DOMAIN_META[domain];
    const score = domainScores[domain];
    page.drawText(meta.title, { x: colX[0], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
    page.drawText(meta.game, { x: colX[1], y, size: PDF_FONT_SIZES.md, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    page.drawText(score !== null && score !== undefined ? `${score}/100` : 'no completado', {
      x: colX[2],
      y,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
    });
    y -= 20;
  }

  y -= 4;
  page.drawText(
    // El índice viaja SIEMPRE con su denominador: la media de un solo dominio
    // completado no puede leerse como el resultado de la batería entera.
    `Índice global: ${efLabelFromTest(test)} (orientativo)`,
    { x: PDF_MARGINS.left, y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 },
  );
  y -= 30;

  // Interpretación
  page.drawText(t('PDF.EXECUTIVE_FUNCTIONS.INTERPRETATION', 'Interpretación orientativa'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 24;
  page.drawText(test.interpretation || '-', {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
    lineHeight: PDF_FONT_SIZES.md * 1.4,
  });
  y -= 96;

  if (test.notes) {
    page.drawText(t('PDF.EXECUTIVE_FUNCTIONS.NOTES', 'Observaciones'), {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.lg,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    y -= 22;
    page.drawText(test.notes, {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.md * 1.4,
    });
    y -= 60;
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
