import { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface DysphagiaDetailProps {
  test: DysphagiaTest;
}

const VISC_LABEL: Record<string, string> = { nectar: 'Néctar', liquido: 'Líquido', pudin: 'Pudin' };

const VERDICT_LABEL: Record<string, string> = {
  safe: 'Exploración negativa · sin disfagia',
  efficacy: 'Disfagia · alteración de la eficacia',
  safety: 'Disfagia · alteración de la seguridad',
};

/**
 * Página de detalle de una exploración de disfagia MECV-V dentro del informe
 * PDF. Mismo estilo que AudiometryDetail / ScreeningDetail.
 */
export async function DysphagiaDetail(
  { test }: DysphagiaDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let y = height - PDF_MARGINS.top;

  // Título
  page.drawText(t('PDF.DYSPHAGIA.TITLE', 'Disfagia orofaríngea (MECV-V)'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 26;
  page.drawText(VERDICT_LABEL[test.verdict] ?? test.verdict, {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
  });
  y -= 34;

  // Recomendación de dieta destacada
  page.drawText(t('PDF.DYSPHAGIA.RECOMMENDATION', 'Recomendación'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 22;
  page.drawText(test.recommendation || '—', {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
  });
  y -= 32;

  // Resumen SpO₂
  const minStr = test.minSpO2 !== null && test.minSpO2 !== undefined ? `${test.minSpO2}%` : '—';
  const dropStr = test.maxDrop !== null && test.maxDrop !== undefined ? `−${test.maxDrop}%` : '—';
  const srcLabel: Record<string, string> = { ble: 'pulsioxímetro BLE', demo: 'demo', manual: 'manual' };
  page.drawText(
    `Basal: ${test.basalSpO2}%   ·   Mínima: ${minStr}   ·   Caída máx.: ${dropStr}   ·   Fuente SpO₂: ${
      srcLabel[test.spo2Source] ?? test.spo2Source
    }`,
    { x: PDF_MARGINS.left, y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 },
  );
  y -= 30;

  // Tabla de bolos evaluados
  const colX = [PDF_MARGINS.left, PDF_MARGINS.left + 130, PDF_MARGINS.left + 210, PDF_MARGINS.left + 300, PDF_MARGINS.left + 400];
  page.drawText('Bolo', { x: colX[0], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  page.drawText('Vol.', { x: colX[1], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  page.drawText('SpO₂', { x: colX[2], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  page.drawText('Seguridad', { x: colX[3], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  page.drawText('Eficacia', { x: colX[4], y, size: PDF_FONT_SIZES.md, font: fonts.semiBold, color: PDF_COLORS.trueGray500 });
  y -= 20;

  const bolus = Array.isArray(test.bolus) ? test.bolus : [];
  for (const b of bolus) {
    if (!b.evaluated || b.skipped) continue;
    const drop = b.spo2 !== null && b.spo2 !== undefined ? test.basalSpO2 - b.spo2 : 0;
    const desat = drop >= 3;
    const safFail = b.safety?.tos || b.safety?.cambio_voz || desat;
    const effFail = b.efficacy?.sello_labial || b.efficacy?.residuo || b.efficacy?.deglucion_fraccionada;
    page.drawText(VISC_LABEL[b.viscosity] ?? b.viscosity, { x: colX[0], y, size: PDF_FONT_SIZES.sm, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    page.drawText(`${b.volume} mL`, { x: colX[1], y, size: PDF_FONT_SIZES.sm, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    page.drawText(b.spo2 !== null && b.spo2 !== undefined ? `${b.spo2}%` : '—', { x: colX[2], y, size: PDF_FONT_SIZES.sm, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    page.drawText(safFail ? 'Alterada' : 'Normal', { x: colX[3], y, size: PDF_FONT_SIZES.sm, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    page.drawText(effFail ? 'Alterada' : 'Normal', { x: colX[4], y, size: PDF_FONT_SIZES.sm, font: fonts.regular, color: PDF_COLORS.trueGray500 });
    y -= 18;
  }

  y -= 14;

  // Interpretación
  page.drawText(t('PDF.DYSPHAGIA.INTERPRETATION', 'Interpretación'), {
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
