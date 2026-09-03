/* -------------------------------------------------------------------------- */
/*  La mascota de la presentación de Lúa cabe en la pantalla que tiene delante. */
/*                                                                            */
/*  Los cortes genéricos —dos columnas, cromo compacto— se miden en            */
/*  `src/Theme/__tests__/screenLayout.test.ts`, que es donde viven. Aquí sólo  */
/*  lo que es de esta pantalla: la talla de Lúa y su halo.                     */
/* -------------------------------------------------------------------------- */
import { computeLuaLayout } from '../luaLayout';

describe('computeLuaLayout', () => {
  it('tableta apaisada: la mascota a tamaño completo', () => {
    const l = computeLuaLayout({ winW: 1024, winH: 768 });

    expect(l.twoColumns).toBe(true);
    expect(l.showcaseSize).toBe(260);
    expect(l.ringRadius).toBe(130);
  });

  it('teléfono estrecho: la mascota cabe en el ancho útil', () => {
    const l = computeLuaLayout({ winW: 360, winH: 740 });

    expect(l.showcaseSize).toBe(190);
    // La tarjeta lleva 12 px de relleno a cada lado sobre 12 de scroll: la
    // mascota tiene que caber en el ancho útil del teléfono más estrecho.
    expect(l.showcaseSize + 2 * 12 + 2 * 12).toBeLessThanOrEqual(360);
  });

  it('teléfono ancho: talla intermedia', () => {
    expect(computeLuaLayout({ winW: 412, winH: 892 }).showcaseSize).toBe(220);
  });

  it('móvil apaisado: la mascota encoge para dejar sitio al dock y a la barra', () => {
    const l = computeLuaLayout({ winW: 740, winH: 360 });

    expect(l.isMobileLandscape).toBe(true);
    expect(l.showcaseSize).toBe(180);
    expect(l.showcaseSize).toBeLessThan(360 - 100 - 56);
  });

  it('la caja de la imagen coincide con el halo en todos los tamaños', () => {
    // El PNG de Lúa trae su propio margen transparente (ocupa el 70 % del
    // lienzo), así que la imagen mide lo mismo que el halo y no se recorta.
    for (const [winW, winH] of [
      [360, 740],
      [412, 892],
      [740, 360],
      [1024, 768],
    ]) {
      const l = computeLuaLayout({ winW: winW!, winH: winH! });
      expect(l.imageSize).toBe(l.showcaseSize);
      expect(l.ringRadius * 2).toBe(l.showcaseSize);
    }
  });
});
