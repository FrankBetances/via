import { PDFFont } from 'pdf-lib';

/* -------------------------------------------------------------------------- */
/*  Red de seguridad de las fuentes estándar del PDF.                          */
/*                                                                            */
/*  Helvetica (fuente estándar, codificación WinAnsi) NO codifica «≤», «≥»,   */
/*  «₂», «→», «✓» ni ningún emoji, y `pdf-lib` LANZA al dibujarlos o al       */
/*  medirlos: «WinAnsi cannot encode "≤" (0x2264)». Una sola frase con «≤»    */
/*  tumbaba el informe entero. Coste real (2/11/2026): desde que el motor NLG */
/*  redacta «Umbral dentro del rango de referencia (≤ 20 dB HL)» y «≥ 65/100», */
/*  las páginas de audiometría y de funciones ejecutivas hacían fallar        */
/*  «Exportar PDF» con «No se pudo compilar el PDF».                          */
/*                                                                            */
/*  Se envuelven los DOS métodos por los que pasa todo texto                  */
/*  (`encodeText` al dibujar, `widthOfTextAtSize` al medir y partir líneas),  */
/*  así que vale para los ~170 `drawText` de los bloques y para la fuente     */
/*  por defecto de cada página. Un carácter que la fuente sí codifica no se   */
/*  toca: una fuente con Unicode completo pasa intacta.                       */
/* -------------------------------------------------------------------------- */

/** Equivalentes legibles antes de rendirse con «?». */
const GLYPH: Record<string, string> = {
  '≤': '<=', // ≤
  '≥': '>=', // ≥
  '₂': '2', // ₂ (SpO₂)
  '→': '->', // →
  '←': '<-', // ←
  '−': '-', // − (signo menos)
  '✓': 'v', // ✓
  '✔': 'v', // ✔
  '✗': 'x', // ✗
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '‑': '-',
};

const encodable = new WeakMap<PDFFont, Map<string, boolean>>();
let installed = false;

/** Texto que esta fuente sí puede codificar. Exportado para los tests. */
export function toEncodable(font: PDFFont, text: string, encode: (t: string) => unknown): string {
  let cache = encodable.get(font);
  if (!cache) {
    cache = new Map();
    encodable.set(font, cache);
  }
  const can = (ch: string): boolean => {
    let ok = cache!.get(ch);
    if (ok === undefined) {
      try {
        encode(ch);
        ok = true;
      } catch {
        ok = false;
      }
      cache!.set(ch, ok);
    }
    return ok;
  };
  let out = '';
  for (const ch of text) {
    if (ch === '\n' || ch === '\r') {
      out += ch;
      continue;
    }
    if (can(ch)) {
      out += ch;
      continue;
    }
    const mapped = GLYPH[ch];
    out += mapped && [...mapped].every(can) ? mapped : '?';
  }
  return out;
}

/** Instala la red una vez por proceso. Idempotente. */
export function installWinAnsiFallback(): void {
  if (installed) return;
  installed = true;
  const encodeText = PDFFont.prototype.encodeText;
  const widthOfTextAtSize = PDFFont.prototype.widthOfTextAtSize;
  PDFFont.prototype.encodeText = function (this: PDFFont, text: string) {
    return encodeText.call(this, toEncodable(this, text, t => encodeText.call(this, t)));
  };
  PDFFont.prototype.widthOfTextAtSize = function (this: PDFFont, text: string, size: number) {
    return widthOfTextAtSize.call(this, toEncodable(this, text, t => encodeText.call(this, t)), size);
  };
}
