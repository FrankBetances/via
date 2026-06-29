import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface ArticulationDetailProps {
  test: ArticulationTest;
}

const SODA_LABEL: Record<string, string> = {
  C: 'Correcto',
  S: 'Sustitución',
  O: 'Omisión',
  D: 'Distorsión',
  A: 'Adición',
};

/** Color del % de acierto: verde alto, ámbar medio, rojo bajo. */
const pctColor = (pct: number) =>
  pct >= 85 ? PDF_COLORS.green500 : pct >= 60 ? PDF_COLORS.amber500 : PDF_COLORS.red500;

/**
 * Página de detalle de un Test de Articulación a la Repetición (T.A.R.) dentro
 * del informe PDF. Sigue el mismo estilo que ScreeningDetail / SahsScreeningDetail
 * (pdf-lib + utils + Logo).
 */
export async function ArticulationDetail(
  { test }: ArticulationDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let currentY = height - PDF_MARGINS.top;

  // === Título ===
  page.drawText(t('PDF.TAR.TITLE', 'Articulación a la Repetición (T.A.R.)'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });

  // % de acierto arriba a la derecha
  const pctLabel = `${test.correctPct}%`;
  const pctWidth = fonts.bold.widthOfTextAtSize(pctLabel, PDF_FONT_SIZES.lg);
  page.drawText(pctLabel, {
    x: width - PDF_MARGINS.right - pctWidth,
    y: currentY + 2,
    size: PDF_FONT_SIZES.lg,
    font: fonts.bold,
    color: pctColor(test.correctPct),
  });

  currentY -= 36;

  // === Subtítulo: ítems evaluados ===
  page.drawText(
    `Ítems registrados: ${test.evaluatedCount} / ${test.totalCount}  ·  Aciertos: ${test.correctPct}%`,
    {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
    },
  );

  currentY -= 36;

  // === Recuento SODA ===
  page.drawText(t('PDF.TAR.SODA', 'Recuento por categoría (SODA)'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 24;

  const counts = test.sodaCounts || ({ C: 0, S: 0, O: 0, D: 0, A: 0 } as Record<string, number>);
  const sodaRows: Array<[string, number]> = [
    ['C', counts.C ?? 0],
    ['S', counts.S ?? 0],
    ['O', counts.O ?? 0],
    ['D', counts.D ?? 0],
    ['A', counts.A ?? 0],
  ];
  const lineHeight = PDF_FONT_SIZES.md + 8;
  for (const [code, n] of sodaRows) {
    if (currentY < PDF_MARGINS.bottom + 80) break;
    page.drawText(SODA_LABEL[code] ?? code, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    const nLabel = `${n}`;
    const nWidth = fonts.regular.widthOfTextAtSize(nLabel, PDF_FONT_SIZES.md);
    page.drawText(nLabel, {
      x: PDF_MARGINS.left + 200 - nWidth,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
    });
    currentY -= lineHeight;
  }

  currentY -= 14;

  // === Fonemas a intervenir ===
  page.drawText(t('PDF.TAR.AFFECTED', 'Fonemas a intervenir'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 24;

  const affected = Array.isArray(test.affectedPhonemes) ? test.affectedPhonemes : [];
  if (affected.length === 0) {
    page.drawText('Inventario completo sin alteraciones registradas.', {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.green500,
    });
    currentY -= lineHeight;
  } else {
    const affLine = affected.map(a => `${a.phoneme} (${a.detail})`).join('   ·   ');
    page.drawText(affLine, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.md * 1.5,
    });
    // estimar líneas consumidas para bajar el cursor
    const approxChars = Math.max(1, Math.floor(maxWidth / (PDF_FONT_SIZES.md * 0.5)));
    const lines = Math.ceil(affLine.length / approxChars);
    currentY -= lines * (PDF_FONT_SIZES.md * 1.5) + 6;
  }

  currentY -= 14;

  // === Observaciones ===
  const obs = test.notes?.obs?.trim();
  if (obs && currentY > PDF_MARGINS.bottom + 80) {
    page.drawText(t('PDF.TAR.NOTES', 'Observaciones'), {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.lg,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    currentY -= 24;
    page.drawText(obs, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.md * 1.45,
    });
    const approxChars = Math.max(1, Math.floor(maxWidth / (PDF_FONT_SIZES.md * 0.5)));
    const lines = Math.ceil(obs.length / approxChars);
    currentY -= lines * (PDF_FONT_SIZES.md * 1.45) + 16;
  }

  // === Evaluador + fecha ===
  const completed = test.completedAt ? new Date(test.completedAt) : null;
  const dateStr = completed
    ? `${String(completed.getDate()).padStart(2, '0')}-${String(completed.getMonth() + 1).padStart(2, '0')}-${String(completed.getFullYear()).slice(2)}`
    : '-';
  page.drawText(
    `Evaluador: ${test.evaluatorName} (${test.evaluatorLicense}) · ${dateStr}`,
    {
      x: PDF_MARGINS.left,
      y: Math.max(currentY, PDF_MARGINS.bottom + 40),
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
    },
  );

  // Aviso clínico al pie
  page.drawText(
    'Registro descriptivo de la producción a la repetición. No sustituye el juicio clínico del fonoaudiólogo.',
    {
      x: PDF_MARGINS.left,
      y: PDF_MARGINS.bottom + 18,
      size: PDF_FONT_SIZES.xs,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
    },
  );

  // Logo al pie
  await Logo({ page, fonts, t });
}
