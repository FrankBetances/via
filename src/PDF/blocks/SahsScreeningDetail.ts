import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface SahsScreeningDetailProps {
  screening: SahsScreening;
}

const SUSPICION_COLOR = {
  low: PDF_COLORS.green500,
  med: PDF_COLORS.amber500,
  high: PDF_COLORS.red500,
} as const;

const SUSPICION_LABEL = {
  low: 'SOSPECHA BAJA',
  med: 'SOSPECHA MEDIA',
  high: 'SOSPECHA ALTA',
} as const;

const IMC_TEXT: Record<string, string> = {
  normo: 'Normopeso',
  sobrepeso: 'Sobrepeso',
  obesidad: 'Obesidad',
};

/**
 * Página de detalle de un cribado de SAHS infantil dentro del informe PDF.
 * Sigue el mismo estilo que ScreeningDetail / GameTestDetail (pdf-lib + utils + Logo).
 */
export async function SahsScreeningDetail(
  { screening }: SahsScreeningDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let currentY = height - PDF_MARGINS.top;

  // === Título ===
  page.drawText(t('PDF.SAHS.TITLE', 'Cribado de SAHS infantil (PSQ de Chervin)'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });

  // Puntuación arriba a la derecha: "X / 13"
  const scoreLabel = `${screening.totalScore} / ${screening.scoreMax}`;
  const scoreWidth = fonts.bold.widthOfTextAtSize(scoreLabel, PDF_FONT_SIZES.lg);
  page.drawText(scoreLabel, {
    x: width - PDF_MARGINS.right - scoreWidth,
    y: currentY + 2,
    size: PDF_FONT_SIZES.lg,
    font: fonts.bold,
    color: PDF_COLORS.trueGray500,
  });

  currentY -= 40;

  // === Nivel de sospecha (color) ===
  const suspColor = SUSPICION_COLOR[screening.suspicionLevel] ?? PDF_COLORS.trueGray500;
  const suspLabel = SUSPICION_LABEL[screening.suspicionLevel] ?? screening.suspicionLevel.toUpperCase();
  page.drawText(suspLabel, {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.xl,
    font: fonts.bold,
    color: suspColor,
  });

  const suspWidth = fonts.bold.widthOfTextAtSize(suspLabel, PDF_FONT_SIZES.xl);
  page.drawText(`  ·  PSQ ${screening.psqYesCount}/${screening.psqTotal}${screening.redFlag ? '  ·  apnea presenciada' : ''}`, {
    x: PDF_MARGINS.left + suspWidth,
    y: currentY,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
  });

  currentY -= 34;

  // === Recomendación / derivación ===
  page.drawText(t('PDF.SAHS.RECOMMENDATION', 'Recomendación · derivación'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 24;

  const recText = `${screening.recommendation || '-'}${screening.referral ? `  (${screening.referral})` : ''}`;
  page.drawText(recText, {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
    lineHeight: PDF_FONT_SIZES.md * 1.4,
  });
  currentY -= 44;

  // === Desglose de puntuación ===
  page.drawText(t('PDF.SAHS.BREAKDOWN', 'Desglose de puntuación'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 24;

  const bd = screening.breakdown || { psq: 0, apnea: 0, brodsky: 0, imc: 0, risk: 0 };
  const rows: Array<[string, string, number]> = [
    ['PSQ de Chervin', `${screening.psqYesCount}/${screening.psqTotal}`, bd.psq],
    ['Apneas presenciadas', screening.redFlag ? 'Sí' : 'No', bd.apnea],
    ['Brodsky', screening.brodsky == null ? '—' : `Grado ${screening.brodsky}`, bd.brodsky],
    ['Estado ponderal', IMC_TEXT[screening.imc ?? ''] ?? '—', bd.imc],
    ['Factores de riesgo', `${(screening.riskFactors || []).length}`, bd.risk],
  ];

  const lineHeight = PDF_FONT_SIZES.md + 8;
  for (const [label, detail, pts] of rows) {
    if (currentY < PDF_MARGINS.bottom + 60) break;
    page.drawText(label, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    page.drawText(detail, {
      x: PDF_MARGINS.left + 170,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
    });
    const ptsLabel = `${pts > 0 ? '+' : ''}${pts} pt`;
    const ptsWidth = fonts.semiBold.widthOfTextAtSize(ptsLabel, PDF_FONT_SIZES.md);
    page.drawText(ptsLabel, {
      x: width - PDF_MARGINS.right - ptsWidth,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.semiBold,
      color: pts > 0 ? suspColor : PDF_COLORS.trueGray500,
    });
    currentY -= lineHeight;
  }

  currentY -= 6;
  const totalLabel = `Puntuación total: ${screening.totalScore} / ${screening.scoreMax}`;
  page.drawText(totalLabel, {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.md,
    font: fonts.bold,
    color: PDF_COLORS.trueGray500,
  });

  currentY -= 30;

  // === Signos / factores marcados ===
  const signs = Array.isArray(screening.signs) ? screening.signs : [];
  const factors = Array.isArray(screening.riskFactors) ? screening.riskFactors : [];
  if (signs.length > 0 && currentY > PDF_MARGINS.bottom + 60) {
    page.drawText(`Signos: ${signs.join(', ')}`, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.sm * 1.4,
    });
    currentY -= 26;
  }
  if (factors.length > 0 && currentY > PDF_MARGINS.bottom + 50) {
    page.drawText(`Factores de riesgo: ${factors.join(', ')}`, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.sm * 1.4,
    });
    currentY -= 30;
  }

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
