import React from 'react';
import { act, create } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

import BienvenidaScreen, { computeStageLayout } from '../BienvenidaScreen';

/* -------------------------------------------------------------------------- */
/*  La bienvenida se ajusta a la pantalla que tiene delante.                   */
/*                                                                            */
/*  El escenario acústico tenía alto FIJO (200 px). En tableta apaisada eso    */
/*  dejaba la columna izquierda flotando con fondo vacío arriba y abajo, y en  */
/*  móviles empujaba el botón de acción fuera del pliegue. Ahora sale de       */
/*  `computeStageLayout`, y esta prueba lo mide en las dos formas de pantalla  */
/*  en las que Frank abre la app.                                             */
/* -------------------------------------------------------------------------- */

const STAGE_CHROME_H = 118;

describe('computeStageLayout', () => {
  it('llena el alto útil en tableta apaisada, sin sobrar ni desbordar', () => {
    const insetTop = 24;
    const insetBottom = 16;
    const winH = 768;
    const { isTabletLandscape, fieldHeight } = computeStageLayout({
      winW: 1024,
      winH,
      insetTop,
      insetBottom,
    });

    expect(isTabletLandscape).toBe(true);

    const availableH = winH - insetTop - insetBottom - 32;
    const cardH = fieldHeight + STAGE_CHROME_H;

    // Ni se sale de la pantalla...
    expect(cardH).toBeLessThanOrEqual(availableH);
    // ...ni deja el hueco que dejaba el alto fijo de 200 px: con 200 px la
    // tarjeta ocupaba el 45 % del alto útil y el resto era fondo.
    expect(cardH).toBeGreaterThan(availableH * 0.7);
    expect(fieldHeight).toBeGreaterThan(200);
  });

  it('encoge en un móvil pequeño para no empujar el CTA fuera de pantalla', () => {
    const { isTabletLandscape, fieldHeight, iconSize } = computeStageLayout({
      winW: 360,
      winH: 640,
      insetTop: 24,
      insetBottom: 0,
    });

    expect(isTabletLandscape).toBe(false);
    expect(fieldHeight).toBeLessThan(200);
    // El isotipo y sus anillos siguen cabiendo dentro del campo.
    expect(iconSize + 20).toBeLessThan(fieldHeight);
  });

  it('deja de crecer en pantallas muy altas para no volverse un cartel', () => {
    const { fieldHeight } = computeStageLayout({
      winW: 1600,
      winH: 2000,
      insetTop: 0,
      insetBottom: 0,
    });
    expect(fieldHeight).toBe(420);
  });

  /* ---------------------------------------------------------------------- */
  /*  4/9/2026: «los iconos quedan descolocados y generan montón de espacio   */
  /*  muerto» en teléfono. El campo acústico repartía su ancho a ciegas: el   */
  /*  isotipo anclado a 18 px con un tamaño que solo miraba el ALTO, y la     */
  /*  onda en un 60 % fijo pegado a la derecha. Con las fórmulas viejas se    */
  /*  pisaban 9 px en 360×800, 8 px en 320×568 y 1 px en 412×915.             */
  /* ---------------------------------------------------------------------- */
  describe('reparto horizontal del campo', () => {
    const PHONES = [
      { winW: 320, winH: 568 },
      { winW: 360, winH: 640 },
      { winW: 360, winH: 800 },
      { winW: 412, winH: 915 },
      { winW: 430, winH: 932 },
    ];

    it.each(PHONES)('el isotipo y la onda no se pisan en $winW×$winH', ({ winW, winH }) => {
      const { fieldWidth, iconSize, iconLeft, waveWidth } = computeStageLayout({
        winW,
        winH,
        insetTop: 24,
        insetBottom: 16,
      });

      const iconEnd = iconLeft + iconSize + 20; // la caja del isotipo con sus anillos
      const waveStart = fieldWidth - waveWidth; // la onda va pegada a la derecha
      expect(waveStart).toBeGreaterThanOrEqual(iconEnd);
    });

    it('la onda ocupa TODO lo que queda: ni se pisa ni deja hueco muerto', () => {
      const { fieldWidth, iconSize, iconLeft, waveWidth } = computeStageLayout({
        winW: 360,
        winH: 800,
        insetTop: 24,
        insetBottom: 16,
      });
      // Antes la onda medía un 58 % del campo pasara lo que pasara. Ahora es
      // exactamente el resto, así que el centro del campo deja de estar vacío.
      expect(iconLeft + iconSize + 20 + waveWidth).toBeLessThanOrEqual(fieldWidth);
      expect(waveWidth).toBeGreaterThan(fieldWidth * 0.4);
    });

    it('el isotipo tampoco se sale por el ancho en una pantalla estrecha y alta', () => {
      // El tamaño salía solo del alto: en una ventana alta y estrecha crecía
      // hasta comerse el campo entero a lo ancho.
      const { fieldWidth, iconSize, iconLeft } = computeStageLayout({
        winW: 320,
        winH: 1200,
        insetTop: 0,
        insetBottom: 0,
      });
      expect(iconLeft + iconSize + 20).toBeLessThan(fieldWidth);
    });
  });

  it('nunca deja el campo por debajo de lo legible', () => {
    const { fieldHeight, iconSize } = computeStageLayout({
      winW: 320,
      winH: 380,
      insetTop: 0,
      insetBottom: 0,
    });
    expect(fieldHeight).toBeGreaterThanOrEqual(150);
    expect(iconSize).toBeGreaterThanOrEqual(62);
  });
});

describe('BienvenidaScreen', () => {
  const SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 1024, height: 768 },
    insets: { top: 24, left: 0, right: 0, bottom: 16 },
  };

  it('monta la pantalla y YA NO pinta la leyenda de la transformación DSP', () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <BienvenidaScreen />
        </SafeAreaProvider>,
      );
    });

    const json = JSON.stringify(tree!.toJSON());

    // Lo que Frank pidió quitar, con las tres piezas del texto.
    expect(json).not.toContain('Transformación determinista');
    expect(json).not.toContain('muestras dispersas');
    expect(json).not.toContain('parámetros biomédicos reproducibles');

    // Y lo que tiene que seguir en pie.
    expect(json).toContain('Comenzar Exploración');
    expect(json).toContain('INFORMACIÓN CLÍNICA');

    act(() => {
      tree!.unmount();
    });
  });
});
