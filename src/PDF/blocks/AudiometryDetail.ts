import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface AudiometryDetailProps {
  test: AudiometryTest;
}

const FREQS = [500, 1000, 2000, 4000];
const FREQ_LABEL: Record<number, string> = { 500: '500', 1000: '1k', 2000: '2k', 4000: '4k' };

const METHOD_LABEL: Record<string, string> = {
  play: 'Audiometría infantil (juego de tonos)',
  conditioned: 'Audiometría condicionada (El Tren del Sonido)',
};

/**
 * Página de detalle de una audiometría tonal dentro del informe PDF.
 * Sirve para ambos métodos (`play` y `conditioned`), diferenciados por la
 * cabecera. Mismo estilo que ScreeningDetail / GameTestDetail.
 */
export async function AudiometryDetail(
  { test }: AudiometryDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let y = height - PDF_MARGINS.top;

  // Título
  page.drawText(t('PDF.AUDIOMETRY.TITLE', 'Audiometría tonal'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 26;
  page.drawText(METHOD_LABEL[test.method] ?? test.method, {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
  });
  y -= 34;

  // Tabla de umbrales
  const colX = [PDF_MARGINS.left, PDF_MARGINS.left + 120, PDF_MARGINS.left + 210, PDF_MARGINS.left + 300, PDF_MARGINS.left + 390];
  page.drawText('Oído', { x: colX[0], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  FREQS.forEach((f, i) => {
    page.drawText(`${FREQ_LABEL[f]} Hz`, { x: colX[i + 1], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  });
  y -= 22;

  (['OD', 'OI'] as const).forEach(ear => {
    page.drawText(ear, { x: colX[0], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
    FREQS.forEach((f, i) => {
      const v = test.thresholds?.[ear]?.[f];
      page.drawText(v !== null && v !== undefined ? `${v}` : '—', {
        x: colX[i + 1],
        y,
        size: PDF_FONT_SIZES.md,
        font: fonts.regular,
        color: PDF_COLORS.trueGray500,
      });
    });
    y -= 20;
  });

  y -= 14;

  // PTA + fiabilidad
  page.drawText(
    `PTA OD: ${test.ptaOD ?? '—'} dB HL    ·    PTA OI: ${test.ptaOI ?? '—'} dB HL    ·    Fiabilidad: ${
      test.reliability !== null && test.reliability !== undefined ? `${test.reliability}%` : '—'
    }`,
    { x: PDF_MARGINS.left, y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 },
  );
  y -= 30;

  // Interpretación
  page.drawText(t('PDF.AUDIOMETRY.INTERPRETATION', 'Interpretación'), {
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
  y -= 56;

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
