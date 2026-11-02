import type { PDFPage } from 'pdf-lib';

import { CATALOGUES } from '@/I18n/catalog';
import { getUiLang } from '@/I18n/uiLang';
import type { UiLang } from '@/I18n/uiLang';
import {
  isNlgCatalogReady,
  nlgMissingDataMessage,
  type ClinicalFact,
  type NlgReportSynthesis,
} from '@/PDF/nlgReportEngine';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_MARGINS, wrapText } from '@/PDF/utils';

import { toPdfText } from './NlgClinicalSynthesis';
import { Logo } from './Logo';
import type { PdfBlockOptions, PdfFonts } from './types';

/* -------------------------------------------------------------------------- */
/*  Anexo de trazabilidad. Una fila por hecho: regla, módulo, medido,         */
/*  evidenceRef. Las columnas salen de `nlg.audit` cuando el bloque existe.   */
/*  Sin hechos utilizables no se pinta una tabla vacía que parezca «todo bien».*/
/* -------------------------------------------------------------------------- */

const PAGE: [number, number] = [595, 842];

interface Cursor {
  page: PDFPage;
}

const contentWidth = (page: PDFPage): number =>
  page.getSize().width - PDF_MARGINS.left - PDF_MARGINS.right;

const startY = (page: PDFPage): number => page.getSize().height - PDF_MARGINS.top;

async function newPage(cursor: Cursor, fonts: PdfFonts, t: PdfBlockOptions['t']): Promise<number> {
  await Logo({ page: cursor.page, fonts, t });
  cursor.page = cursor.page.doc.addPage(PAGE);
  return startY(cursor.page);
}

async function drawWrapped(
  cursor: Cursor,
  y: number,
  text: string,
  font: PdfFonts['regular'],
  size: number,
  fonts: PdfFonts,
  t: PdfBlockOptions['t'],
): Promise<number> {
  const safe = toPdfText(text, font);
  const width = contentWidth(cursor.page);
  const lineHeight = size * 1.35;
  const chunks = safe.split('\n').filter(line => line.trim().length > 0);
  let cursorY = y;
  for (const chunk of chunks) {
    const lines = wrapText(chunk, font, size, width);
    for (const line of lines) {
      if (cursorY - lineHeight < PDF_MARGINS.bottom) {
        cursorY = await newPage(cursor, fonts, t);
      }
      cursor.page.drawText(line, {
        x: PDF_MARGINS.left,
        y: cursorY,
        size,
        font,
        color: PDF_COLORS.trueGray700,
      });
      cursorY -= lineHeight;
    }
  }
  return cursorY;
}

/**
 * Rótulos de columna. Sin bloque `nlg` en la lengua activa se usan los de
 * castellano: son nombres de columna, no frases clínicas de gl, eu, ca o en.
 */
function auditLabels(lang: UiLang): {
  title: string;
  rule: string;
  module: string;
  measured: string;
  evidence: string;
} | null {
  const packLang = isNlgCatalogReady(lang) ? lang : null;
  if (!packLang && !isNlgCatalogReady('es')) return null;
  const pack = CATALOGUES[packLang ?? 'es'].nlg;
  return {
    title: pack.sections.auditTrailTitle,
    rule: pack.audit.columnRule,
    module: pack.audit.columnModule,
    measured: pack.audit.columnMeasured,
    evidence: pack.audit.columnEvidence,
  };
}

const rowText = (labels: NonNullable<ReturnType<typeof auditLabels>>, fact: ClinicalFact): string =>
  [
    `${labels.rule}: ${fact.ruleId}`,
    `${labels.module}: ${fact.module}`,
    `${labels.measured}: ${JSON.stringify(fact.measured)}`,
    `${labels.evidence}: ${fact.evidenceRef}`,
  ].join(' | ');

export interface NlgAuditTrailProps {
  synthesis: NlgReportSynthesis | null;
  readFailed?: boolean;
}

export async function NlgAuditTrail(
  { synthesis, readFailed }: NlgAuditTrailProps,
  { page, fonts, t }: PdfBlockOptions,
): Promise<void> {
  const lang = getUiLang();
  const cursor: Cursor = { page };
  let y = startY(page);
  const failed = Boolean(readFailed) || !synthesis || synthesis.unavailableReason != null;

  if (failed || !synthesis) {
    const notice = synthesis?.unavailableReason
      ? synthesis.formattedReportText
      : nlgMissingDataMessage(lang);
    await drawWrapped(cursor, y, notice, fonts.regular, PDF_FONT_SIZES.md, fonts, t);
    await Logo({ page: cursor.page, fonts, t });
    return;
  }

  const facts = synthesis.facts;

  const labels = auditLabels(lang);
  if (!labels) {
    await drawWrapped(cursor, y, nlgMissingDataMessage(lang), fonts.regular, PDF_FONT_SIZES.md, fonts, t);
    await Logo({ page: cursor.page, fonts, t });
    return;
  }

  y = await drawWrapped(cursor, y, labels.title, fonts.semiBold, PDF_FONT_SIZES.xl, fonts, t);
  y -= 8;
  const header = [labels.rule, labels.module, labels.measured, labels.evidence].join(' | ');
  y = await drawWrapped(cursor, y, header, fonts.semiBold, PDF_FONT_SIZES.sm, fonts, t);
  y -= 6;

  for (const fact of facts) {
    y = await drawWrapped(cursor, y, rowText(labels, fact), fonts.regular, PDF_FONT_SIZES.xs, fonts, t);
    y -= 6;
  }

  await Logo({ page: cursor.page, fonts, t });
}
