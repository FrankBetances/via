import { ILLUSTRATION_ASPECT } from '../ModuleIllustration';
import { computeGridLayout } from '../seleccionLayout';

/* -------------------------------------------------------------------------- */
/*  El hub clínico en un TELÉFONO.                                            */
/*                                                                            */
/*  Informe de Frank (4/9/2026): «los botones de comprobación o para iniciar   */
/*  un ejercicio quedan fuera de la pantalla» y «las tarjetas se ven vacías,   */
/*  los dibujos son demasiado pequeños».                                       */
/*                                                                            */
/*  Lo segundo se puede medir sin abrir la app, y es aritmética, no gusto: la  */
/*  banda del dibujo medía 52 px fijos y dentro el SVG se pintaba a 160 px de  */
/*  ancho (viewBox 160×48 con alto fijo de 48 → escala 1), así que en una      */
/*  tarjeta de 284 px útiles sobraban 124 px —el 44 %— de vacío.               */
/* -------------------------------------------------------------------------- */

/** Relleno interno de la tarjeta, los dos lados (`ModuleCardItem`). */
const CARD_PADDING_X = 28;

describe('computeGridLayout', () => {
  it('en teléfono va a una columna y el dibujo llena el ancho de la tarjeta', () => {
    const { isPhone, numColumns, cardWidth, illustrationHeight } = computeGridLayout({
      width: 360,
    });

    expect(isPhone).toBe(true);
    expect(numColumns).toBe(1);

    // El alto sale del ancho útil por la proporción del propio lienzo: es la
    // condición para que el dibujo se escale por el ANCHO y no deje bandas.
    const inner = cardWidth - CARD_PADDING_X;
    expect(illustrationHeight).toBe(Math.round(inner * ILLUSTRATION_ASPECT));

    // Y en números: donde había 52 px de banda ahora hay bastante más.
    expect(illustrationHeight).toBeGreaterThan(80);
  });

  it('la tableta 4:3 conserva sus cuatro columnas, y su dibujo también crece', () => {
    const { numColumns, isPhone, illustrationHeight, horizontalPadding } = computeGridLayout({
      width: 1024,
    });
    expect(numColumns).toBe(4);
    expect(isPhone).toBe(false);
    expect(horizontalPadding).toBe(24);
    // 22 % de la banda era vacío también aquí.
    expect(illustrationHeight).toBeGreaterThan(52);
  });

  it('las tarjetas caben en el ancho disponible, columnas y huecos incluidos', () => {
    for (const width of [320, 360, 412, 680, 834, 1024, 1280]) {
      const { numColumns, gap, horizontalPadding, cardWidth } = computeGridLayout({ width });
      const used = cardWidth * numColumns + gap * (numColumns - 1) + horizontalPadding * 2;
      expect(used).toBeLessThanOrEqual(width + 0.001);
      expect(cardWidth).toBeGreaterThan(0);
    }
  });

  it('en teléfono reserva más hueco bajo la parrilla: el muelle va apilado', () => {
    // Con el hueco de tableta, el muelle apilado tapaba las últimas tarjetas.
    expect(computeGridLayout({ width: 360 }).dockClearance).toBeGreaterThan(
      computeGridLayout({ width: 1024 }).dockClearance,
    );
  });

  it('el dibujo no se dispara en pantallas anchas a una columna', () => {
    // Una ventana estrecha pero enorme (o un plegable) no debe convertir la
    // banda en un cartel que empuje los metadatos fuera de la tarjeta.
    expect(computeGridLayout({ width: 679 }).illustrationHeight).toBeLessThanOrEqual(132);
  });
});
