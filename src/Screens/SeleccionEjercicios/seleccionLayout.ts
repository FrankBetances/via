import { ILLUSTRATION_ASPECT } from './ModuleIllustration';

/* -------------------------------------------------------------------------- */
/*  Reparto de la pantalla del hub clínico según el ancho REAL del dispositivo.*/
/*                                                                            */
/*  Vive fuera de la pantalla —como `moduleCards.ts`— para poder medirlo sin   */
/*  arrastrar `react-redux` ni gluestack, que jest no transforma.              */
/*                                                                            */
/*  La pantalla se diseñó para la tableta 4:3 de la referencia visual y en un  */
/*  teléfono se rompía por los dos extremos: la barra superior y el muelle de  */
/*  acciones son filas ÚNICAS con `space-between` y sin envolver, así que sus  */
/*  botones —«Comprobar audio» arriba, «Iniciar prueba» abajo— se salían por   */
/*  la derecha; y las tarjetas, pensadas para cuatro columnas, quedaban con    */
/*  una banda de dibujo enorme y medio vacía a una sola columna.               */
/* -------------------------------------------------------------------------- */

/** Relleno interno de la tarjeta (`ModuleCardItem`), a los dos lados. */
const CARD_PADDING_X = 14 * 2;

/** Alto mínimo y máximo de la banda del dibujo. */
const ILLUSTRATION_MIN = 52;
const ILLUSTRATION_MAX = 132;

/** Por debajo de este ancho la pantalla se trata como teléfono. */
export const PHONE_MAX_WIDTH = 680;

export interface GridLayout {
  /** Teléfono: una columna, cabecera y muelle apilados. */
  isPhone: boolean;
  numColumns: number;
  gap: number;
  horizontalPadding: number;
  /** Ancho de cada tarjeta, SIEMPRE en píxeles (antes era '100%' a una columna). */
  cardWidth: number;
  /** Alto de la banda del dibujo, derivado del ancho útil de la tarjeta. */
  illustrationHeight: number;
  /** Hueco que hay que dejar bajo la parrilla para que el muelle no la tape. */
  dockClearance: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function computeGridLayout({ width }: { width: number }): GridLayout {
  const numColumns = width >= 980 ? 4 : width >= PHONE_MAX_WIDTH ? 2 : 1;
  const isPhone = numColumns === 1;
  const gap = 14;
  // En un teléfono cada píxel de ancho cuenta: 24 px por lado se llevaban 48
  // de los 360 que hay, y la tarjeta es la que los necesita.
  const horizontalPadding = isPhone ? 16 : 24;
  const availableWidth = width - horizontalPadding * 2;
  const cardWidth = (availableWidth - gap * (numColumns - 1)) / numColumns;

  /* El dibujo llena el ancho útil de la tarjeta manteniendo la proporción de
   * su lienzo. Antes la banda era de 52 px SIEMPRE y el dibujo se pintaba a
   * 160 px de ancho dentro de ella, mirase lo que mirase la tarjeta. */
  const illustrationHeight = Math.round(
    clamp((cardWidth - CARD_PADDING_X) * ILLUSTRATION_ASPECT, ILLUSTRATION_MIN, ILLUSTRATION_MAX),
  );

  /* El muelle de acciones flota sobre la parrilla. En teléfono se apila en dos
   * filas (estado arriba, botones abajo) y es más alto, así que el hueco que
   * hay que reservarle debajo de la lista también crece: con el valor de
   * tableta, las últimas tarjetas quedaban debajo del muelle. */
  const dockClearance = isPhone ? 168 : 110;

  return {
    isPhone,
    numColumns,
    gap,
    horizontalPadding,
    cardWidth,
    illustrationHeight,
    dockClearance,
  };
}
