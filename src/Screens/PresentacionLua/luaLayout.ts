/* -------------------------------------------------------------------------- */
/*  Reparto de la ventana de la presentación de Lúa.                           */
/*                                                                            */
/*  Vive fuera del componente por dos motivos. Uno de diseño —es el patrón de  */
/*  `computeStageLayout` en la bienvenida: los cortes se miden con números—; y */
/*  otro práctico: importar la pantalla desde una prueba arrastra              */
/*  `@gluestack-ui/themed`, que Jest no transforma. Aquí no hay nada que       */
/*  transformar.                                                              */
/* -------------------------------------------------------------------------- */
export interface LuaLayout {
  /** Dos columnas: la tarjeta de Lúa a la izquierda y la ficha a la derecha. */
  twoColumns: boolean;
  isTabletLandscape: boolean;
  isMobileLandscape: boolean;
  /** Cromo compacto: tipografías, iconos y rellenos reducidos. */
  isMobile: boolean;
  isSmallPhone: boolean;
  showcaseSize: number;
  imageSize: number;
  ringRadius: number;
}

/**
 * Reparte la ventana entre las dos columnas y dimensiona la mascota.
 *
 * Función pura y exportada por el mismo motivo que `computeStageLayout` de la
 * bienvenida: los cortes se miden con números en `__tests__/luaLayout.test.ts`.
 * Montar la pantalla y espiar `useWindowDimensions` NO sirve —medido: el espía
 * se llama 0 veces y el componente sigue viendo el viewport por defecto—, así
 * que una prueba escrita así pasa sin comprobar ningún corte.
 *
 * El cromo compacto NO se decide sólo por el ancho. Un móvil apaisado
 * (740 × 360) mide más de 600 px de ancho y entraba en dos columnas con
 * tipografías, iconos y rellenos de escritorio dentro de 360 px de alto.
 */
export function computeLuaLayout({ winW, winH }: { winW: number; winH: number }): LuaLayout {
  const isLandscape = winW > winH;
  const isTabletLandscape = (winW >= 850 && isLandscape) || winW >= 960;
  const isMobileLandscape = isLandscape && winH < 520 && !isTabletLandscape;
  const isMobile = winW < 600 || isMobileLandscape;
  const isSmallPhone = winW < 380;

  const showcaseSize = isSmallPhone ? 190 : isMobileLandscape ? 180 : winW < 600 ? 220 : 260;

  return {
    twoColumns: isTabletLandscape || isMobileLandscape,
    isTabletLandscape,
    isMobileLandscape,
    isMobile,
    isSmallPhone,
    showcaseSize,
    /* La foto lleva su propio margen: Lúa ocupa el 70 % del PNG y el resto es
     * transparente, así que la caja de la imagen coincide con el halo. */
    imageSize: showcaseSize,
    ringRadius: Math.round(showcaseSize / 2),
  };
}
