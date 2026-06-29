import { PDF_MARGINS, PDF_FONT_SIZES, PDF_COLORS } from '@/PDF/utils';
import type { PdfBlockOptions } from './types';

/* -------------------------------------------------------------------------- */
/*  Pie de página común de los bloques de detalle — VIA+.                   */
/*  Los paquetes de módulo originales dibujan aquí el logotipo de marca       */
/*  (imagen embebida). No hay un asset de logo disponible todavía en este     */
/*  repo, así que este bloque dibuja un pie de texto equivalente («VIA+») y    */
/*  mantiene el mismo punto de extensión: cuando se incorpore el logo real,   */
/*  basta con sustituir el cuerpo de esta función sin tocar quien la llama.   */
/* -------------------------------------------------------------------------- */

export async function Logo({ page, fonts, t }: PdfBlockOptions): Promise<void> {
  const { width } = page.getSize();
  const label = t('PDF.BRAND', 'VIA+') as string;
  page.drawText(label, {
    x: width - PDF_MARGINS.right - fonts.semiBold.widthOfTextAtSize(label, PDF_FONT_SIZES.xs),
    y: PDF_MARGINS.bottom - 24,
    size: PDF_FONT_SIZES.xs,
    font: fonts.semiBold,
    color: PDF_COLORS.trueGray500,
  });
}
