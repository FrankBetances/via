import { AshaMilestoneTest } from '@/Models/Asha/AshaMilestoneTest';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS, textHeight } from '@/PDF/utils';
import { Logo } from './Logo';
import { ASHA_MILESTONES, ASHA_AGE_BANDS, AshaDomain } from '@/Screens/AshaScreening/ashaMilestones';

interface AshaScreeningDetailProps {
  test: AshaMilestoneTest;
}

const RISK_COLOR = {
  green: PDF_COLORS.green500,
  yellow: PDF_COLORS.amber500,
  red: PDF_COLORS.red500,
} as const;

const RISK_LABEL = {
  green: 'NORMOTÍPICO (BAJO RIESGO)',
  yellow: 'RIESGO MODERADO (RETRASO LEVE)',
  red: 'RIESGO ALTO (BANDERAS ROJAS)',
} as const;

const DOMAIN_NAME: Record<AshaDomain, string> = {
  receptive: 'Receptivo',
  expressive: 'Expresivo',
  pragmatic: 'Pragmático',
};

/**
 * Bloque PDF para el informe clínico del Cribado de Hitos ASHA.
 * Cumple con directrices SaMD Clase IIa / IEC 62304 Clase B.
 */
export async function AshaScreeningDetail(
  { test }: AshaScreeningDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let currentY = height - PDF_MARGINS.top;

  // === 1. Título y Banda de Edad ===
  page.drawText(t('PDF.ASHA.TITLE', 'Cribado de Hitos del Desarrollo ASHA'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });

  const ageBandObj = ASHA_AGE_BANDS.find(b => b.id === test.ageBand);
  const bandLabel = ageBandObj ? `Banda: ${ageBandObj.label}` : `Banda: ${test.ageBand}`;
  const bandWidth = fonts.bold.widthOfTextAtSize(bandLabel, PDF_FONT_SIZES.md);

  page.drawText(bandLabel, {
    x: width - PDF_MARGINS.right - bandWidth,
    y: currentY + 2,
    size: PDF_FONT_SIZES.md,
    font: fonts.bold,
    color: PDF_COLORS.trueGray500,
  });

  currentY -= 36;

  // === 2. Veredicto y Nivel de Riesgo ===
  const riskColor = RISK_COLOR[test.riskLevel] ?? PDF_COLORS.trueGray500;
  const riskText = RISK_LABEL[test.riskLevel] ?? test.riskLevel.toUpperCase();

  page.drawText(riskText, {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.xl,
    font: fonts.bold,
    color: riskColor,
  });

  currentY -= 26;

  // === 3. Dominios Comprometidos ===
  const failedDomains = Array.isArray(test.failedDomains) ? test.failedDomains : [];
  const domainsStr =
    failedDomains.length > 0
      ? `Dominios con retraso: ${failedDomains.map(d => DOMAIN_NAME[d as AshaDomain] ?? d).join(', ')}`
      : 'Todos los dominios evaluados (Receptivo, Expresivo, Pragmático) en percentil normativo.';

  const DOMAINS_LINE_HEIGHT = PDF_FONT_SIZES.md * 1.3;
  page.drawText(domainsStr, {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
    lineHeight: DOMAINS_LINE_HEIGHT,
  });

  currentY -=
    textHeight(domainsStr, fonts.regular, PDF_FONT_SIZES.md, maxWidth, DOMAINS_LINE_HEIGHT) + 18;

  // === 4. Rutas de Derivación Recomendadas ===
  page.drawText(t('PDF.ASHA.REFERRALS', 'Rutas de Derivación y Plan de Acción'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 20;

  const storedReferrals = Array.isArray(test.recommendedReferrals) ? test.recommendedReferrals : [];
  const referrals = storedReferrals.length
    ? storedReferrals
    : ['Sin derivaciones interdisciplinares requeridas en este momento.'];
  const REFERRAL_LINE_HEIGHT = PDF_FONT_SIZES.md * 1.3;
  for (const ref of referrals) {
    const line = `• ${ref}`;
    page.drawText(line, {
      x: PDF_MARGINS.left + 10,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth: maxWidth - 10,
      lineHeight: REFERRAL_LINE_HEIGHT,
    });
    currentY -=
      textHeight(line, fonts.regular, PDF_FONT_SIZES.md, maxWidth - 10, REFERRAL_LINE_HEIGHT) + 6;
  }

  currentY -= 14;

  // === 5. Detalle de Respuestas / Banderas Rojas ===
  const responses = test.responses || {};
  const bandMilestones = ASHA_MILESTONES.filter(m => m.ageBand === test.ageBand);

  page.drawText(t('PDF.ASHA.ITEMS', 'Desglose de Hitos Evaluados (Percentil 75)'), {
    x: PDF_MARGINS.left,
    y: currentY,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  currentY -= 20;

  const ITEM_LINE_HEIGHT = PDF_FONT_SIZES.sm * 1.3;
  let omitted = 0;

  for (const m of bandMilestones) {
    const answer = responses[m.id];
    // Un hito SIN RESPUESTA no es un hito fallado. La pantalla exige
    // contestarlos todos antes de guardar, pero un registro antiguo o de otra
    // banda puede llegar incompleto, y presentarlo como «NO CUMPLE» sería
    // inventar un dato clínico que nadie ha observado.
    const statusMark =
      answer === true ? '[ CUMPLE ]' : answer === false ? '[ NO CUMPLE ]' : '[ SIN EVALUAR ]';
    const statusColor =
      answer === true
        ? PDF_COLORS.green500
        : answer === false
          ? m.isRedFlag
            ? PDF_COLORS.red500
            : PDF_COLORS.amber500
          : PDF_COLORS.trueGray500;

    const flagNotice = m.isRedFlag ? ' (BANDERA ROJA)' : '';
    const itemHeader = `${statusMark}${flagNotice} [${DOMAIN_NAME[m.domain]}]:`;
    const headerWidth = fonts.bold.widthOfTextAtSize(itemHeader, PDF_FONT_SIZES.sm) + 6;

    // Alto REAL del reactivo: `drawText` con `maxWidth` envuelve el texto, así
    // que un avance fijo (18 pt) solapaba cada enunciado con el siguiente —
    // los hitos de ASHA ocupan dos y tres líneas.
    const itemHeight = textHeight(
      m.text,
      fonts.regular,
      PDF_FONT_SIZES.sm,
      maxWidth - headerWidth,
      ITEM_LINE_HEIGHT,
    );

    if (currentY - itemHeight < PDF_MARGINS.bottom + 90) {
      omitted += 1;
      continue;
    }

    page.drawText(itemHeader, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.sm,
      font: fonts.bold,
      color: statusColor,
    });

    page.drawText(m.text, {
      x: PDF_MARGINS.left + headerWidth,
      y: currentY,
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth: maxWidth - headerWidth,
      lineHeight: ITEM_LINE_HEIGHT,
    });

    currentY -= itemHeight + 6;
  }

  // Un desglose recortado por falta de sitio DICE que está recortado: si no,
  // el informe presenta menos reactivos de los que se evaluaron y nadie puede
  // notarlo leyéndolo.
  if (omitted > 0) {
    page.drawText(
      `(${omitted} reactivo(s) no caben en esta página; el veredicto de arriba los incluye todos.)`,
      {
        x: PDF_MARGINS.left,
        y: Math.max(currentY, PDF_MARGINS.bottom + 74),
        size: PDF_FONT_SIZES.xs,
        font: fonts.regular,
        color: PDF_COLORS.trueGray500,
        maxWidth,
      },
    );
    currentY -= 14;
  }

  currentY -= 10;

  // === 6. Observaciones del Clínico ===
  if (test.notes && currentY > PDF_MARGINS.bottom + 60) {
    page.drawText('Observaciones clínicas:', {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.md,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    currentY -= 18;

    page.drawText(test.notes, {
      x: PDF_MARGINS.left,
      y: currentY,
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.sm * 1.3,
    });
    currentY -= 24;
  }

  // === 7. Evaluador y Fecha ===
  const completed = new Date(test.completedAt ?? test.createdAt ?? Date.now());
  const dateStr = `${String(completed.getDate()).padStart(2, '0')}-${String(
    completed.getMonth() + 1,
  ).padStart(2, '0')}-${completed.getFullYear()}`;

  const evaluatorStr = `Evaluador: ${test.evaluatorName || 'Clínico'} (${
    test.evaluatorLicense || 'N/A'
  }) · Fecha: ${dateStr}`;

  page.drawText(evaluatorStr, {
    x: PDF_MARGINS.left,
    y: Math.max(currentY, PDF_MARGINS.bottom + 42),
    size: PDF_FONT_SIZES.sm,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
  });

  // === 8. DISCLAIMER REGULATORIO OBLIGATORIO (ISO 14971 / SaMD Clase IIa) ===
  const disclaimerText =
    'Herramienta CDSS Clase IIa. Resultados orientativos basados en umbrales de percentil 75 de ASHA. No constituye diagnóstico automatizado ni sustituye el juicio clínico.';

  page.drawText(disclaimerText, {
    x: PDF_MARGINS.left,
    y: PDF_MARGINS.bottom + 24,
    size: PDF_FONT_SIZES.xs,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
  });

  // Logo institucional al pie
  await Logo({ page, fonts, t });
}
