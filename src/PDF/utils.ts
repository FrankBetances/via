import { rgb, type PDFFont } from 'pdf-lib';

/* -------------------------------------------------------------------------- */
/*  Utilidades compartidas de los bloques PDF — VIA+.                        */
/*  Constantes de layout (márgenes, tamaños de fuente) y paleta de color      */
/*  usadas por todos los bloques de detalle (`PDF/blocks/*.ts`). Mismo        */
/*  patrón que los paquetes `*(React Native)` (`@/PDF/utils`), adaptado a     */
/*  `pdf-lib` (sin dependencias externas de color).                          */
/* -------------------------------------------------------------------------- */

export const PDF_MARGINS = {
  top: 64,
  bottom: 56,
  left: 48,
  right: 48,
};

export const PDF_FONT_SIZES = {
  '2xs': 7,
  xs: 8,
  sm: 9,
  md: 10.5,
  lg: 13,
  xl: 16,
  '2xl': 20,
};

export const PDF_COLORS = {
  trueGray500: rgb(0.45, 0.45, 0.45),
  trueGray700: rgb(0.25, 0.25, 0.25),
  green500: rgb(0.31, 0.6, 0.4),
  amber500: rgb(0.88, 0.66, 0.24),
  red500: rgb(0.82, 0.34, 0.29),
  primary500: rgb(0.88, 0.54, 0.24),
};

/* -------------------------------------------------------------------------- */
/*  Medida de texto.                                                          */
/*                                                                            */
/*  `page.drawText` con `maxWidth` ENVUELVE el texto, pero no dice en cuántas */
/*  líneas: el bloque que lo dibuja no sabe cuánto bajar después. Escribir un */
/*  avance fijo hace que dos párrafos largos seguidos se solapen en el        */
/*  informe, y eso no lo ve ningún test que solo mire que el PDF se genera.   */
/* -------------------------------------------------------------------------- */

/**
 * Parte un texto en las líneas que `drawText` va a pintar con ese `maxWidth`.
 * Corta por palabras; una palabra más ancha que la caja se deja en su propia
 * línea (pdf-lib la desborda, pero es preferible a un bucle infinito).
 */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/** Alto que ocupará `text` al dibujarlo con `maxWidth` y ese interlineado. */
export function textHeight(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lineHeight: number = size * 1.3,
): number {
  return wrapText(text, font, size, maxWidth).length * lineHeight;
}
