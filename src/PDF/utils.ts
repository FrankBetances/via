import { rgb } from 'pdf-lib';

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
