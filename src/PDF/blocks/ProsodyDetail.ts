import { ProsodyAnalysis } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { prosodyReasonLabel, prosodyReportRows } from '@/Screens/ProsodyAnalysis/prosodyResult';
import { BlockOptions } from './types';
import { PDF_FONT_SIZES, PDF_MARGINS, PDF_COLORS } from '@/PDF/utils';
import { Logo } from './Logo';

interface ProsodyDetailProps {
  analysis: ProsodyAnalysis;
}

/** Etiqueta legible de la tarea de habla con la que se obtuvo la muestra. */
const TASK_LABEL: Record<string, string> = {
  'narracion-lamina': 'Narración sobre lámina',
  'recuento-historia': 'Recuento de historia',
  lectura: 'Lectura en voz alta',
};

const AGE_BAND_LABEL: Record<string, string> = {
  prelector: 'Prelector (3–6 a)',
  lector: 'Lector (7–12 a)',
};

/**
 * Página de detalle del análisis prosódico dentro del informe PDF.
 *
 * DOS COSAS DEBEN CONSTAR SIEMPRE, y no son adorno:
 *
 *  · La TAREA con la que se tomó la muestra. La tasa de habla depende
 *    fuertemente de qué se pidió, así que un valor sin su tarea no es
 *    comparable con nada — ni con otra sesión del mismo niño.
 *  · Que los valores son DESCRIPTIVOS y sin baremo. Sin esa línea, una tabla
 *    de cifras en un informe clínico se lee como si tuviera rangos de
 *    normalidad detrás, y no los tiene: no existen baremos pediátricos
 *    españoles de prosodia (decisión B0.2).
 */
export async function ProsodyDetail(
  { analysis }: ProsodyDetailProps,
  { page, fonts, t }: BlockOptions,
): Promise<void> {
  const { width, height } = page.getSize();
  const maxWidth = width - PDF_MARGINS.left - PDF_MARGINS.right;
  let y = height - PDF_MARGINS.top;

  page.drawText(t('PDF.PROSODY.TITLE', 'Análisis prosódico'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES['2xl'],
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 34;

  // Procedencia de la muestra: tarea, banda de edad y estímulo concreto.
  page.drawText(
    `${TASK_LABEL[analysis.task] ?? analysis.task} · ${AGE_BAND_LABEL[analysis.ageBand] ?? analysis.ageBand}` +
      (analysis.stimulusId ? ` · estímulo ${analysis.stimulusId}` : ''),
    {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
    },
  );
  y -= 28;

  const metrics = analysis.metrics;
  if (!metrics || analysis.reason !== 'ok') {
    page.drawText(prosodyReasonLabel(analysis.reason), {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
    });
    y -= 30;
  }

  if (metrics) {
    // Filas en el mismo orden que la pantalla: primero tono, después ritmo.
    for (const row of prosodyReportRows(metrics)) {
      page.drawText(row.label, {
        x: PDF_MARGINS.left,
        y,
        size: PDF_FONT_SIZES.md,
        font: fonts.semiBold,
        color: PDF_COLORS.trueGray500,
      });
      // «no medido» NO es «0»: se imprime literalmente para que nadie lo lea
      // como una medida de valor cero.
      page.drawText(row.value === null ? 'no medido' : `${row.value} ${row.unit}`.trim(), {
        x: PDF_MARGINS.left + 180,
        y,
        size: PDF_FONT_SIZES.md,
        font: fonts.regular,
        color: PDF_COLORS.trueGray500,
      });
      y -= PDF_FONT_SIZES.md + 8;
    }
  }

  y -= 12;

  page.drawText(t('PDF.PROSODY.INTERPRETATION', 'Registro descriptivo'), {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.lg,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
  y -= 22;
  page.drawText(analysis.interpretation || '-', {
    x: PDF_MARGINS.left,
    y,
    size: PDF_FONT_SIZES.md,
    font: fonts.regular,
    color: PDF_COLORS.trueGray500,
    maxWidth,
    lineHeight: PDF_FONT_SIZES.md * 1.4,
  });
  y -= 56;

  if (analysis.notes?.obs) {
    page.drawText(t('PDF.PROSODY.NOTES', 'Observaciones'), {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.lg,
      font: fonts.semiBold,
      color: PDF_COLORS.trueGray500,
    });
    y -= 20;
    page.drawText(analysis.notes.obs, {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.md,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.md * 1.4,
    });
    y -= 48;
  }

  // Advertencia obligatoria (B0.2). Va SIEMPRE, haya o no métricas.
  page.drawText(
    t(
      'PDF.PROSODY.DISCLAIMER',
      'Valores descriptivos sin baremo poblacional: no se emite juicio de normalidad. ' +
        'La comparación válida es con tomas anteriores del mismo paciente en la misma tarea. ' +
        'Las medidas acústicas no sustituyen la valoración perceptiva del logopeda.',
    ),
    {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
      lineHeight: PDF_FONT_SIZES.sm * 1.4,
    },
  );
  y -= 48;

  const completed = analysis.completedAt ? new Date(analysis.completedAt) : null;
  const dateStr = completed
    ? `${String(completed.getDate()).padStart(2, '0')}-${String(completed.getMonth() + 1).padStart(2, '0')}-${String(
        completed.getFullYear(),
      ).slice(2)}`
    : '-';
  page.drawText(
    `Evaluador: ${analysis.evaluatorName} (${analysis.evaluatorLicense}) · ${dateStr}`,
    {
      x: PDF_MARGINS.left,
      y,
      size: PDF_FONT_SIZES.sm,
      font: fonts.regular,
      color: PDF_COLORS.trueGray500,
      maxWidth,
    },
  );

  if (analysis.evaluatorSignatureSvg) {
    y -= 20;
    page.drawText(t('PDF.PROSODY.SIGNATURE', 'Firma del explorador:'), {
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
        scale: 0.45,
        borderColor: PDF_COLORS.trueGray500,
        borderWidth: 1,
      });
    } catch {
      // Un trazo corrupto no debe tumbar la generación del informe.
    }
  }

  await Logo({ page, fonts, t });
}
