/* -------------------------------------------------------------------------- */
/*  Reparto de la ventana de la presentación de Lúa.                           */
/*                                                                            */
/*  Los cortes genéricos —dos columnas, cromo compacto, teléfono estrecho—     */
/*  viven en `@/Theme/screenLayout`, compartidos con créditos. Aquí sólo se    */
/*  añade lo que es de esta pantalla: la talla de la mascota y su halo.        */
/*                                                                            */
/*  Vive fuera del componente por dos motivos. Uno de diseño —es el patrón de  */
/*  `computeStageLayout` en la bienvenida: los cortes se miden con números en  */
/*  `__tests__/luaLayout.test.ts`—; y otro práctico: importar la pantalla      */
/*  desde una prueba arrastra `@gluestack-ui/themed`, que Jest no transforma.  */
/*  Aquí no hay nada que transformar.                                          */
/* -------------------------------------------------------------------------- */
import { computeScreenLayout, ScreenLayout } from '@/Theme/screenLayout';

export interface LuaLayout extends ScreenLayout {
  showcaseSize: number;
  imageSize: number;
  ringRadius: number;
}

/** Reparte la ventana y dimensiona la mascota dentro de su tarjeta. */
export function computeLuaLayout({ winW, winH }: { winW: number; winH: number }): LuaLayout {
  const screen = computeScreenLayout({ winW, winH });

  /* El apaisado de móvil deja poco alto útil —dock abajo y barra arriba—, así
   * que la mascota encoge más ahí que en un teléfono en vertical. */
  const showcaseSize = screen.isSmallPhone
    ? 190
    : screen.isMobileLandscape
      ? 180
      : winW < 600
        ? 220
        : 260;

  return {
    ...screen,
    showcaseSize,
    /* La foto lleva su propio margen: Lúa ocupa el 70 % del PNG y el resto es
     * transparente, así que la caja de la imagen coincide con el halo. */
    imageSize: showcaseSize,
    ringRadius: Math.round(showcaseSize / 2),
  };
}
