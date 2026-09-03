/* -------------------------------------------------------------------------- */
/*  Cortes de tamaño de pantalla, en un solo sitio.                            */
/*                                                                            */
/*  Antes había tres definiciones distintas de «tableta» en el repositorio:    */
/*  `winW >= 850` en créditos y en la bienvenida, `winW >= 800` en resultados  */
/*  preliminares y `850 apaisado || 960` en la presentación de Lúa. Tres       */
/*  números que nadie eligió juntos, en pantallas con la misma estructura de   */
/*  dos columnas: la que se arregla mejora sola y las demás se quedan.         */
/*                                                                            */
/*  Es una función pura y se mide con números en `__tests__/screenLayout.ts`.  */
/*  Montar la pantalla y espiar `useWindowDimensions` NO sirve —medido: el     */
/*  espía se llama 0 veces y el componente sigue viendo el viewport por        */
/*  defecto—, y `scripts/__tests__/windowDimensionsSpy.test.js` lo impide.     */
/* -------------------------------------------------------------------------- */

export interface ScreenLayout {
  /** Dos columnas: cabe una junto a otra sin estrujar ninguna. */
  twoColumns: boolean;
  isTabletLandscape: boolean;
  isMobileLandscape: boolean;
  /** Cromo compacto: tipografías, iconos y rellenos reducidos. */
  isMobile: boolean;
  isSmallPhone: boolean;
}

/**
 * Reparte la ventana.
 *
 * El cromo compacto NO se decide sólo por el ancho. Un móvil apaisado
 * (740 × 360) mide más de 600 px de ancho y entraba en dos columnas con
 * tipografías, iconos y rellenos de escritorio dentro de 360 px de alto.
 */
export function computeScreenLayout({
  winW,
  winH,
}: {
  winW: number;
  winH: number;
}): ScreenLayout {
  const isLandscape = winW > winH;
  const isTabletLandscape = (winW >= 850 && isLandscape) || winW >= 960;
  const isMobileLandscape = isLandscape && winH < 520 && !isTabletLandscape;

  return {
    twoColumns: isTabletLandscape || isMobileLandscape,
    isTabletLandscape,
    isMobileLandscape,
    isMobile: winW < 600 || isMobileLandscape,
    isSmallPhone: winW < 380,
  };
}

/** Ancho máximo del contenido: en una tableta grande el texto no se estira. */
export const CONTENT_MAX_WIDTH = 1120;
