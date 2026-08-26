import { PDFDocument, StandardFonts } from 'pdf-lib';

import { AshaScreeningDetail } from '../AshaScreeningDetail';
import { PDF_MARGINS, wrapText } from '@/PDF/utils';
import type { AshaMilestoneTest } from '@/Models/Asha/AshaMilestoneTest';
import { evaluateAshaScreening } from '@/Screens/AshaScreening/ashaCdssEngine';
import {
  ASHA_AGE_BANDS,
  ASHA_MILESTONES,
  getMilestonesForAgeBand,
} from '@/Screens/AshaScreening/ashaMilestones';

/* -------------------------------------------------------------------------- */
/*  El informe se DIBUJA de verdad, banda por banda.                           */
/*                                                                            */
/*  COSTE REAL. La primera versión de este bloque escribía el enunciado del    */
/*  hito `asha_2_3_exp_1`, que contenía un «≥». Las fuentes estándar de        */
/*  pdf-lib codifican en WinAnsi y ese carácter no está: `drawText` LANZA. Y   */
/*  `Report.ts` no envuelve los bloques en try, así que un niño de 2–3 años    */
/*  con cribado ASHA dejaba SIN GENERAR el informe entero de la batería, no    */
/*  solo esta página. Ni `tsc` ni un test del catálogo ven eso.                */
/*                                                                            */
/*  Por eso aquí se renderiza contra pdf-lib real: cualquier texto que el      */
/*  bloque no pueda escribir revienta la prueba, venga del catálogo, del motor */
/*  CDSS o de las observaciones del clínico.                                   */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE: [number, number] = [595, 842];

const t = (key: string, fallback?: string | Record<string, unknown>) =>
  typeof fallback === 'string' ? fallback : key;

const buildContext = async () => {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    semiBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  return { pdfDoc, fonts };
};

const buildTest = (
  ageBand: string,
  responses: Record<string, boolean>,
  notes = '',
): AshaMilestoneTest => {
  const milestones = getMilestonesForAgeBand(ageBand as never);
  const cdss = evaluateAshaScreening(responses, milestones);
  // Objeto plano, no la entidad: importar el modelo arrastraría TypeORM al
  // entorno de Jest, y el bloque solo LEE campos. Lo que se prueba aquí es el
  // dibujado, no el mapeo del ORM.
  return {
    id: 'test-uuid',
    ageBand,
    responses,
    riskLevel: cdss.riskLevel,
    recommendedReferrals: cdss.recommendedReferrals,
    failedDomains: cdss.failedDomains,
    evaluatorName: 'María Ángeles Núñez',
    evaluatorLicense: 'CO-12345',
    notes,
    completedAt: new Date('2026-08-26T10:00:00Z'),
    createdAt: new Date('2026-08-26T10:00:00Z'),
  } as unknown as AshaMilestoneTest;
};

const answerAll = (ageBand: string, value: boolean): Record<string, boolean> =>
  Object.fromEntries(getMilestonesForAgeBand(ageBand as never).map(m => [m.id, value]));

interface DrawnSpan {
  text: string;
  top: number;
  bottom: number;
}

/**
 * Renderiza el bloque interceptando `drawText` y devuelve, para cada texto
 * ENVUELTO del cuerpo (los que llevan `maxWidth`), la franja vertical que
 * ocupa de verdad: la `y` que recibe pdf-lib es la línea BASE de la primera
 * línea, y cada línea adicional baja un `lineHeight`.
 */
const drawnSpans = async (
  ageBand: string,
  responses: Record<string, boolean>,
): Promise<DrawnSpan[]> => {
  const { pdfDoc, fonts } = await buildContext();
  const page = pdfDoc.addPage(PAGE_SIZE);
  const spans: DrawnSpan[] = [];
  const realDrawText = page.drawText.bind(page);
  page.drawText = ((text: string, options: any) => {
    if (typeof options?.maxWidth === 'number' && options.y > PDF_MARGINS.bottom + 90) {
      const size = options.size ?? 12;
      const lineHeight = options.lineHeight ?? size;
      const lines = wrapText(text, options.font, size, options.maxWidth).length || 1;
      spans.push({
        text,
        top: options.y + size * 0.8, // ascendente aproximado de Helvetica
        bottom: options.y - (lines - 1) * lineHeight,
      });
    }
    return realDrawText(text, options);
  }) as typeof page.drawText;

  await AshaScreeningDetail({ test: buildTest(ageBand, responses) }, { page, fonts, t });
  return spans;
};

describe('AshaScreeningDetail · dibujado real con pdf-lib', () => {
  it.each(ASHA_AGE_BANDS.map(b => b.id))(
    'la banda %s se dibuja con todos los hitos cumplidos y con todos fallados',
    async ageBand => {
      for (const value of [true, false]) {
        const { pdfDoc, fonts } = await buildContext();
        const page = pdfDoc.addPage(PAGE_SIZE);
        await AshaScreeningDetail(
          { test: buildTest(ageBand, answerAll(ageBand, value)) },
          { page, fonts, t },
        );
        await expect(pdfDoc.save()).resolves.toBeInstanceOf(Uint8Array);
      }
    },
  );

  it('ningún enunciado del catálogo usa caracteres que la fuente no pueda escribir', async () => {
    const { pdfDoc, fonts } = await buildContext();
    const page = pdfDoc.addPage(PAGE_SIZE);
    for (const m of ASHA_MILESTONES) {
      for (const text of [m.text, m.description ?? '']) {
        expect(() =>
          page.drawText(text, { x: 40, y: 400, size: 9, font: fonts.regular }),
        ).not.toThrow();
      }
    }
  });

  it('un cribado sin ninguna respuesta se dibuja igual (no se presume fallado)', async () => {
    const { pdfDoc, fonts } = await buildContext();
    const page = pdfDoc.addPage(PAGE_SIZE);
    await AshaScreeningDetail({ test: buildTest('2-3y', {}) }, { page, fonts, t });
    await expect(pdfDoc.save()).resolves.toBeInstanceOf(Uint8Array);
  });

  it('unas observaciones largas del clínico no tumban la página', async () => {
    const { pdfDoc, fonts } = await buildContext();
    const page = pdfDoc.addPage(PAGE_SIZE);
    const notes = 'Observación clínica extensa. '.repeat(40);
    await AshaScreeningDetail(
      { test: buildTest('4-5y', answerAll('4-5y', false), notes) },
      { page, fonts, t },
    );
    await expect(pdfDoc.save()).resolves.toBeInstanceOf(Uint8Array);
  });

  it('los reactivos no se solapan: cada bloque avanza por su alto real', async () => {
    // El bloque hacía `currentY -= 18` fijo mientras `drawText` envolvía cada
    // enunciado en dos y tres líneas, así que los hitos se pisaban unos a
    // otros en el informe. Un test que solo mire que las `y` van bajando NO lo
    // detecta —bajaban, solo que demasiado poco—, así que se comparan las
    // FRANJAS verticales que ocupa cada bloque.
    const spans = await drawnSpans('2-3y', answerAll('2-3y', false));
    expect(spans.length).toBeGreaterThan(3);
    for (let i = 1; i < spans.length; i++) {
      const solapa = spans[i].top > spans[i - 1].bottom;
      expect(
        solapa ? `«${spans[i].text.slice(0, 50)}…» se solapa con el bloque anterior` : 'ok',
      ).toBe('ok');
    }
  });
});
