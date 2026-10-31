import type { PDFFont, PDFPage } from 'pdf-lib';

import { CATALOGUES } from '@/I18n/catalog';
import { getUiLang } from '@/I18n/uiLang';
import type { UiLang } from '@/I18n/uiLang';
import {
  isNlgCatalogReady,
  nlgMissingDataMessage,
  type NlgReportSynthesis,
} from '@/PDF/nlgReportEngine';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_MARGINS, wrapText } from '@/PDF/utils';

import { Logo } from './Logo';
import type { PdfBlockOptions, PdfFonts } from './types';

/* -------------------------------------------------------------------------- */
/*  Síntesis clínica del informe. El texto llega ya renderizado del motor.    */
/*  Este bloque no redacta frases clínicas: pinta ese texto, los títulos de   */
/*  sección del catálogo y, aparte, las observaciones y la firma del clínico. */
/* -------------------------------------------------------------------------- */

const PAGE: [number, number] = [595, 842];

/**
 * Helvetica (WinAnsi) no codifica ≥, ≤ ni el subíndice de SpO₂. Se sustituyen
 * al dibujar. El catálogo castellano no se toca.
 */
const GLYPH: Record<string, string> = {
  '\u2265': '>=',
  '\u2264': '<=',
  '\u2013': '-',
  '\u2014': '-',
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2026': '...',
  '\u2082': '2',
  '\u00a0': ' ',
  '\u2212': '-',
};

export function toPdfText(text: string, font: PDFFont): string {
  let out = '';
  for (const ch of text) {
    if (ch === '\n' || ch === '\r' || ch === '\t') {
      out += ch === '\t' ? ' ' : ch;
      continue;
    }
    const mapped = GLYPH[ch] ?? ch;
    try {
      font.widthOfTextAtSize(mapped, 10);
      out += mapped;
    } catch {
      out += '?';
    }
  }
  return out;
}

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
  font: PDFFont,
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
    cursorY -= 4;
  }
  return cursorY;
}

function sectionLabel(lang: UiLang, key: 'executiveSummary' | 'crossFindings'): string | null {
  if (!isNlgCatalogReady(lang)) return null;
  return CATALOGUES[lang].nlg.sections[key];
}

/**
 * Etiqueta de interfaz. Si la lengua activa no tiene bloque `nlg`, se usa la
 * castellana: no es una traducción clínica, es el mismo rótulo que ya existe
 * en `strings.es.ts` para no dejar el campo mudo ni inventar una frase en
 * gl, eu, ca o en.
 */
function uiLabel(lang: UiLang, key: 'observationsLabel' | 'signatureLabel'): string {
  if (isNlgCatalogReady(lang)) return CATALOGUES[lang].nlg.ui[key];
  return CATALOGUES.es.nlg.ui[key];
}

export interface NlgClinicalSynthesisProps {
  synthesis: NlgReportSynthesis | null;
  notes?: string;
  signatureSvg?: string | null;
  readFailed?: boolean;
}

export async function NlgClinicalSynthesis(
  { synthesis, notes, signatureSvg, readFailed }: NlgClinicalSynthesisProps,
  { page, fonts, t }: PdfBlockOptions,
): Promise<void> {
  const lang = getUiLang();
  const cursor: Cursor = { page };
  let y = startY(page);
  const failed = Boolean(readFailed) || !synthesis || synthesis.unavailableReason != null;
  const notice = synthesis?.unavailableReason
    ? synthesis.formattedReportText
    : nlgMissingDataMessage(lang);

  if (failed) {
    y = await drawWrapped(cursor, y, notice, fonts.regular, PDF_FONT_SIZES.md, fonts, t);
  } else {
    const title = sectionLabel(lang, 'executiveSummary');
    if (title) {
      y = await drawWrapped(cursor, y, title, fonts.semiBold, PDF_FONT_SIZES.xl, fonts, t);
    }
    const cross = synthesis.crossModuleFindings;
    if (cross.length > 0) {
      const heading = sectionLabel(lang, 'crossFindings');
      if (heading) {
        y = await drawWrapped(cursor, y, heading, fonts.semiBold, PDF_FONT_SIZES.lg, fonts, t);
      }
      for (const fact of cross) {
        y = await drawWrapped(cursor, y, fact.text, fonts.regular, PDF_FONT_SIZES.md, fonts, t);
      }
    }
    for (const fact of synthesis.facts) {
      if (fact.category === 'cross') continue;
      y = await drawWrapped(cursor, y, fact.text, fonts.regular, PDF_FONT_SIZES.md, fonts, t);
    }
    if (synthesis.facts.length > 0) {
      const lines = synthesis.formattedReportText.split('\n');
      const disclaimer = lines[lines.length - 1] ?? '';
      if (disclaimer.trim()) {
        y = await drawWrapped(cursor, y, disclaimer, fonts.regular, PDF_FONT_SIZES.sm, fonts, t);
      }
    }
  }

  const freeText = notes?.trim() ?? '';
  if (freeText) {
    y = await drawWrapped(
      cursor,
      y,
      uiLabel(lang, 'observationsLabel'),
      fonts.semiBold,
      PDF_FONT_SIZES.md,
      fonts,
      t,
    );
    y = await drawWrapped(cursor, y, freeText, fonts.regular, PDF_FONT_SIZES.md, fonts, t);
  }

  const svg = signatureSvg?.trim() ?? '';
  if (svg) {
    if (y - 80 < PDF_MARGINS.bottom) y = await newPage(cursor, fonts, t);
    y = await drawWrapped(
      cursor,
      y,
      uiLabel(lang, 'signatureLabel'),
      fonts.semiBold,
      PDF_FONT_SIZES.md,
      fonts,
      t,
    );
    try {
      cursor.page.drawSvgPath(svg, {
        x: PDF_MARGINS.left,
        y: y + 8,
        scale: 0.45,
        borderColor: PDF_COLORS.trueGray700,
        borderWidth: 1,
      });
    } catch {
      // Un trazo ilegible no tumba el informe. La síntesis ya está pintada.
    }
  }

  await Logo({ page: cursor.page, fonts, t });
}
