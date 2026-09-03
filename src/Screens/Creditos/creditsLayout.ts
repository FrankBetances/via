/* -------------------------------------------------------------------------- */
/*  Reparto de la ventana de la pantalla de créditos.                          */
/*                                                                            */
/*  Los cortes genéricos viven en `@/Theme/screenLayout`, compartidos con la   */
/*  presentación de Lúa. Aquí sólo lo propio: la constelación de trece puntos  */
/*  orbitando el isotipo, que tenía 200 px FIJOS. En un teléfono apaisado —360 */
/*  px de alto, con barra arriba y dock abajo— la constelación sola se comía   */
/*  el hueco útil, así que encoge con la pantalla.                             */
/*                                                                            */
/*  Los radios de las órbitas están escritos a mano en `orbitModules.ts` para  */
/*  que la constelación sea reproducible: no se tocan, se ESCALAN con el mismo */
/*  factor que el emblema. Si se escalara el envoltorio y no los radios, los   */
/*  puntos se saldrían de la tarjeta.                                          */
/* -------------------------------------------------------------------------- */
import { computeScreenLayout, ScreenLayout } from '@/Theme/screenLayout';

/** Medidas de la constelación a tamaño completo, tal como estaban a fuego. */
const EMBLEM_BOX = 200;
const CORE = 84;
const RING = CORE + 36;
const ISOTYPE = 56;

export interface CreditsLayout extends ScreenLayout {
  /** Factor que se aplica al emblema Y a los radios de las órbitas. */
  emblemScale: number;
  emblemBox: number;
  coreSize: number;
  ringSize: number;
  isotypeSize: number;
}

export function computeCreditsLayout({
  winW,
  winH,
}: {
  winW: number;
  winH: number;
}): CreditsLayout {
  const screen = computeScreenLayout({ winW, winH });

  const emblemScale = screen.isMobileLandscape ? 0.7 : screen.isSmallPhone ? 0.82 : 1;

  return {
    ...screen,
    emblemScale,
    emblemBox: Math.round(EMBLEM_BOX * emblemScale),
    coreSize: Math.round(CORE * emblemScale),
    ringSize: Math.round(RING * emblemScale),
    isotypeSize: Math.round(ISOTYPE * emblemScale),
  };
}
