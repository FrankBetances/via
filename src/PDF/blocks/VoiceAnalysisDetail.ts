import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { grbasSeverityLabel, grbasSummary } from '@/Screens/VoiceAnalysis/voiceAnalysisResult';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface VoiceAnalysisDetailProps {
  analysis: VoiceAnalysis;
}

/**
 * Página de detalle de un análisis acústico de voz dentro del informe PDF.
 * Mismo estilo que ScreeningDetail / GameTestDetail (pdf-lib + PDF utils + Logo).
 */
export async function VoiceAnalysisDetail(
  { analysis }: VoiceAnalysisDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let y = height - PDF_MARGINS.top;

  // Título
  page.drawText(t('PDF.VOICE.TITLE', 'Análisis acústico de voz'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 40;

  // Parámetros principales (tabla simple en 2 columnas). Los campos acústicos
  // son anulables: null = prueba cerrada manualmente (solo valoración GRBAS).
  const manualClosure = analysis.f0 == null;
  const rows: [string, string][] = manualClosure
    ? [
        ['Análisis acústico', 'No disponible · cierre manual de la prueba'],
        ['Vocal / fuente', `/${analysis.vowel}/ · ${analysis.source === 'mic' ? 'micrófono' : 'demostración'}`],
      ]
    : [
        ['F0 (pitch medio)', `${analysis.f0} Hz`],
        ['Jitter', `${analysis.jitter} %`],
        ['Shimmer', `${analysis.shimmer} %`],
        ['HNR', `${analysis.hnr} dB`],
        [
          'Formantes',
          analysis.formants
            ? `F1 ${analysis.formants.f1} · F2 ${analysis.formants.f2} · F3 ${analysis.formants.f3} Hz`
            : 'No estimables en la toma',
        ],
        ['Vocal / fuente', `/${analysis.vowel}/ · ${analysis.source === 'mic' ? 'micrófono' : 'demostración'}`],
      ];
  if (analysis.grbas) {
    rows.push(['GRBAS (perceptual)', `${grbasSummary(analysis.grbas)} — ${grbasSeverityLabel(analysis.grbas)}`]);
  }
  for (const [label, value] of rows) {
    page.drawText(label, {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.md,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    page.drawText(value, {
      x: PDF_MARGINS.left + 180,
      y,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
    });
    y -= PDF_FONT_SIZES.md + 10;
  }

  y -= 14;

  // Interpretación
  page.drawText(t('PDF.VOICE.INTERPRETATION', 'Interpretación clínica'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 24;
  page.drawText(analysis.interpretation || '-', {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
    lineHeight: PDF_FONT_SIZES.md * 1.4,
  });
  y -= 72;

  if (analysis.notes) {
    page.drawText(t('PDF.VOICE.NOTES', 'Observaciones'), {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.lg,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    y -= 22;
    page.drawText(analysis.notes, {
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
  const completed = analysis.completedAt ? new Date(analysis.completedAt) : null;
  const dateStr = completed
    ? `${String(completed.getDate()).padStart(2, '0')}-${String(completed.getMonth() + 1).padStart(2, '0')}-${String(
        completed.getFullYear(),
      ).slice(2)}`
    : '-';
  page.drawText(`Evaluador: ${analysis.evaluatorName} (${analysis.evaluatorLicense}) · ${dateStr}`, {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.sm,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
  });

  // Firma manuscrita del explorador (constancia de la prueba, obligatoria en
  // el cierre manual). El path SVG se dibuja tal cual: drawSvgPath usa el
  // convenio SVG (y hacia abajo) desde la esquina (x, y).
  if (analysis.evaluatorSignatureSvg) {
    y -= 20;
    page.drawText(t('PDF.VOICE.SIGNATURE', 'Firma del explorador:'), {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.sm,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    try {
      page.drawSvgPath(analysis.evaluatorSignatureSvg, {
        x: PDF_MARGINS.left + 130,
        y: y + 14,
        scale: 0.45, // pad de 150 px de alto → ~68 pt en el informe
        borderColor: PDF_COLORS.trueGray500,
        borderWidth: 1,
      });
    } catch {
      // Un trazo corrupto no debe tumbar la generación del informe.
    }
  }

  await Logo({ page, fonts, t });
}
