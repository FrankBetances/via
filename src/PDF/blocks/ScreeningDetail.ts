import { Screening } from '@/Models/Screening/Screening';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface ScreeningDetailProps {
  screening: Screening;
}

const RISK_COLOR = {
  low: PDF_COLORS.green500,
  med: PDF_COLORS.amber500,
  high: PDF_COLORS.red500,
} as const;

const RISK_LABEL = {
  low: 'RIESGO BAJO',
  med: 'RIESGO MEDIO',
  high: 'RIESGO ALTO',
} as const;

/**
 * Página de detalle de un cribado (autismo/TEA) dentro del informe PDF.
 * Sigue el mismo estilo que GameTestDetail (pdf-lib + PDF utils + Logo).
 */
export async function ScreeningDetail({ screening }: ScreeningDetailProps, { page, fonts, t }: BlockOptions): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let currentY = height - PDF_MARGINS.top;

  // === Título ===
  page.drawText(t('PDF.SCREENING.TITLE', 'Cribado de autismo (TEA)'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });

  // Puntuación arriba a la derecha: "X / 20"
  const scoreLabel = `${screening.score} / ${screening.total}`;
  const scoreWidth = fonts.bold.widthOfTextAtSize(scoreLabel, PDF_FONT_SIZES.lg);
  page.drawText(scoreLabel, {
    x: width - PDF_MARGINS.right - scoreWidth,
    y: currentY + 2,
    size: PDF_FONT_SIZES.lg,
    font: fonts.bold,
    color: PDF_COLORS.trueGray500,
  });

  currentY -= 40;

  // === Nivel de riesgo (color) ===
  const riskColor = RISK_COLOR[screening.riskLevel] ?? PDF_COLORS.trueGray500;
  const riskLabel = RISK_LABEL[screening.riskLevel] ?? screening.riskLevel.toUpperCase();
  page.drawText(riskLabel, {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.xl,
    font: fonts.bold,
    color: riskColor,
  });

  const rangeText = `  ·  ${screening.rangeLabel}`;
  const riskWidth = fonts.bold.widthOfTextAtSize(riskLabel, PDF_FONT_SIZES.xl);
  page.drawText(rangeText, {
    x: PDF_MARGINS.left + riskWidth,
    y: currentY,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
  });

  currentY -= 34;

  // === Recomendación ===
  page.drawText(t('PDF.SCREENING.RECOMMENDATION', 'Recomendación clínica'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 24;

  page.drawText(screening.recommendation || '-', {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
    lineHeight: PDF_FONT_SIZES.md * 1.4,
  });
  // Reserva vertical aproximada para la recomendación (≈3 líneas).
  currentY -= 70;

  // === Ítems de riesgo marcados ===
  page.drawText(t('PDF.SCREENING.FLAGGED_ITEMS', 'Ítems de riesgo marcados'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 24;

  const flagged = Array.isArray(screening.flaggedItems) ? screening.flaggedItems : [];
  if (flagged.length === 0) {
    page.drawText(t('PDF.SCREENING.NO_FLAGS', 'Ninguna respuesta de riesgo.'), {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.green500,
    });
    currentY -= PDF_FONT_SIZES.md + 6;
  } else {
    const lineHeight = PDF_FONT_SIZES.md + 6;
    for (const item of flagged) {
      if (currentY < PDF_MARGINS.bottom + 40) break; // no desbordar la página
      const code = `${item.code}`;
      page.drawText(code, {
        x: PDF_MARGINS.left,
        y: currentY,
        size: PDF_FONT_SIZES.md,
        font: fonts.semiBold,
        color: riskColor,
      });
      const codeWidth = fonts.semiBold.widthOfTextAtSize(code, PDF_FONT_SIZES.md) + 10;
      page.drawText(`${item.label}  (${item.answer})`, {
        x: PDF_MARGINS.left + codeWidth,
        y: currentY,
        size: PDF_FONT_SIZES.md,
        font: fonts.regular,
        color: PDF_COLORS.trueGray500,
        maxWidth: maxWidth - codeWidth,
      });
      currentY -= lineHeight;
    }
  }

  currentY -= 16;

  // === Evaluador + fecha ===
  const completed = screening.completedAt ? new Date(screening.completedAt) : null;
  const dateStr = completed
    ? `${String(completed.getDate()).padStart(2, '0')}-${String(completed.getMonth() + 1).padStart(2, '0')}-${String(completed.getFullYear()).slice(2)}`
    : '-';
  page.drawText(
    `Evaluador: ${screening.evaluatorName} (${screening.evaluatorLicense}) · ${dateStr}`,
    {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
    },
  );

  // Logo al pie
  await Logo({ page, fonts, t });
}
