import { ClinicalAssessment, ClinicalGlobalResult } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface ClinicalAssessmentDetailProps {
  assessment: ClinicalAssessment;
}

const GLOBAL_COLOR: Record<ClinicalGlobalResult, any> = {
  FULL: PDF_COLORS.green500,
  PARTIAL: PDF_COLORS.amber500,
  BLOCKED: PDF_COLORS.red500,
};

const DOMAIN_LABEL: Record<string, string> = {
  ok: 'APTO',
  warn: 'RESTRICCIÓN',
  block: 'BLOQUEO',
  pending: 'PENDIENTE',
};

/**
 * Página de detalle del Certificado de Aptitud para la Prueba (CAP) dentro del
 * informe PDF. Mismo estilo que ScreeningDetail / GameTestDetail (pdf-lib +
 * PDF utils + Logo).
 */
export async function ClinicalAssessmentDetail(
  { assessment }: ClinicalAssessmentDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let currentY = height - PDF_MARGINS.top;

  // === Título ===
  page.drawText(t('PDF.CAP.TITLE', 'Evaluación Clínica Previa (CAP)'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });

  // Pruebas habilitadas arriba a la derecha: "X / Y"
  const gamesLabel = `${assessment.activeGames} / ${assessment.totalGames}`;
  const gamesWidth = fonts.bold.widthOfTextAtSize(gamesLabel, PDF_FONT_SIZES.lg);
  page.drawText(gamesLabel, {
    x: width - PDF_MARGINS.right - gamesWidth,
    y: currentY + 2,
    size: PDF_FONT_SIZES.lg,
    font: fonts.bold,
    color: PDF_COLORS.trueGray500,
  });

  currentY -= 40;

  // === Resultado global (color) ===
  const globalColor = GLOBAL_COLOR[assessment.globalResult] ?? PDF_COLORS.trueGray500;
  page.drawText(assessment.globalLabel, {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.xl,
    font: fonts.bold,
    color: globalColor,
  });

  currentY -= 34;

  // === Resultado por dominio ===
  page.drawText(t('PDF.CAP.DOMAINS', 'Resultado por dominio'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 24;

  const domains = assessment.domains;
  const domainRows: { label: string; kind: string }[] = [
    { label: 'Otoscopia', kind: domains?.otoscopia?.kind ?? 'pending' },
    { label: 'Capacidad visual', kind: domains?.visual?.kind ?? 'pending' },
    { label: 'Capacidad verbal', kind: domains?.verbal?.kind ?? 'pending' },
    { label: 'Capacidad motora', kind: domains?.motor?.kind ?? 'pending' },
  ];

  const lineHeight = PDF_FONT_SIZES.md + 8;
  for (const row of domainRows) {
    page.drawText(row.label, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
    });
    const statusLabel = DOMAIN_LABEL[row.kind] ?? row.kind.toUpperCase();
    const statusWidth = fonts.semiBold.widthOfTextAtSize(statusLabel, PDF_FONT_SIZES.sm);
    page.drawText(statusLabel, {
      x: width - PDF_MARGINS.right - statusWidth,
      y: currentY,
      size: PDF_FONT_SIZES.sm,
      font: fonts.semiBold,
      color: row.kind === 'ok' ? PDF_COLORS.green500 : row.kind === 'warn' ? PDF_COLORS.amber500 : row.kind === 'block' ? PDF_COLORS.red500 : PDF_COLORS.trueGray500,
    });
    currentY -= lineHeight;
  }

  currentY -= 12;

  // === Pruebas de la sesión ===
  page.drawText(t('PDF.CAP.GAMES', 'Pruebas de la sesión'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 24;

  const games = Array.isArray(assessment.games) ? assessment.games : [];
  for (const g of games) {
    if (currentY < PDF_MARGINS.bottom + 60) break;
    const mark = g.active ? '✓' : '✗';
    page.drawText(`${mark}  ${g.code}`, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.semiBold,
      color: g.active ? PDF_COLORS.green500 : PDF_COLORS.red500,
    });
    const codeWidth = fonts.semiBold.widthOfTextAtSize(`${mark}  ${g.code}`, PDF_FONT_SIZES.md) + 12;
    page.drawText(`${g.title}  —  ${g.reason}`, {
      x: PDF_MARGINS.left + codeWidth,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth: maxWidth - codeWidth,
    });
    currentY -= lineHeight;
  }

  currentY -= 16;

  // === Evaluador + fecha ===
  const completed = assessment.completedAt ? new Date(assessment.completedAt) : null;
  const dateStr = completed
    ? `${String(completed.getDate()).padStart(2, '0')}-${String(completed.getMonth() + 1).padStart(2, '0')}-${String(completed.getFullYear()).slice(2)}`
    : '-';
  page.drawText(
    `Evaluador: ${assessment.evaluatorName} (${assessment.evaluatorLicense}) · ${dateStr}`,
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
