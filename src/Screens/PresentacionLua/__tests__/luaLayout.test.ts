/* -------------------------------------------------------------------------- */
/*  La presentación de Lúa se ajusta a la pantalla que tiene delante.          */
/*                                                                            */
/*  Esta prueba sustituye a dos que NO comprobaban nada. Montaban la pantalla  */
/*  con `jest.spyOn(ReactNative, 'useWindowDimensions')` y afirmaban en el     */
/*  título «< 380» y «>= 850»; medido con una sonda, el espía se llamaba CERO  */
/*  veces y las dos renderizaban el mismo viewport por defecto —el árbol       */
/*  seguía trayendo la mascota de 260 px, la rama de escritorio—. Pasaban      */
/*  porque sólo miraban que tres cadenas del catálogo estuvieran presentes,    */
/*  cosa que ocurre en cualquier tamaño.                                      */
/*                                                                            */
/*  Aquí se mide la función pura, como en `bienvenidaLayout.test.tsx`: los     */
/*  cortes se comprueban con números y sin depender de que un espía llegue     */
/*  hasta dentro del componente.                                              */
/* -------------------------------------------------------------------------- */
import { computeLuaLayout } from '../luaLayout';

describe('computeLuaLayout', () => {
  it('tableta apaisada: dos columnas y la mascota a tamaño completo', () => {
    const l = computeLuaLayout({ winW: 1024, winH: 768 });

    expect(l.isTabletLandscape).toBe(true);
    expect(l.twoColumns).toBe(true);
    expect(l.isMobile).toBe(false);
    expect(l.showcaseSize).toBe(260);
    expect(l.ringRadius).toBe(130);
  });

  it('tableta en vertical: sigue habiendo sitio para dos columnas a partir de 960', () => {
    expect(computeLuaLayout({ winW: 1024, winH: 1366 }).twoColumns).toBe(true);
    // Una tableta estrecha en vertical NO: 820 px de ancho en una columna.
    expect(computeLuaLayout({ winW: 820, winH: 1180 }).twoColumns).toBe(false);
  });

  it('móvil en vertical: una columna, cromo compacto y mascota reducida', () => {
    const l = computeLuaLayout({ winW: 360, winH: 740 });

    expect(l.twoColumns).toBe(false);
    expect(l.isMobile).toBe(true);
    expect(l.isSmallPhone).toBe(true);
    expect(l.showcaseSize).toBe(190);
    // La tarjeta lleva 12 px de relleno a cada lado sobre 12 de scroll: la
    // mascota tiene que caber en el ancho útil del teléfono más estrecho.
    expect(l.showcaseSize + 2 * 12 + 2 * 12).toBeLessThanOrEqual(360);
  });

  it('móvil ancho en vertical: compacto, pero sin llegar a la talla mínima', () => {
    const l = computeLuaLayout({ winW: 412, winH: 892 });

    expect(l.isMobile).toBe(true);
    expect(l.isSmallPhone).toBe(false);
    expect(l.showcaseSize).toBe(220);
  });

  it('MÓVIL APAISADO: dos columnas, pero con el cromo compacto, no el de escritorio', () => {
    // 740 × 360 mide más de 600 px de ancho: con el corte por ancho a secas
    // entraba en dos columnas con tipografías, iconos y rellenos de escritorio
    // dentro de 360 px de alto.
    const l = computeLuaLayout({ winW: 740, winH: 360 });

    expect(l.isMobileLandscape).toBe(true);
    expect(l.twoColumns).toBe(true);
    expect(l.isMobile).toBe(true);
    expect(l.isTabletLandscape).toBe(false);
    expect(l.showcaseSize).toBe(180);
    // La mascota y el halo caben en el alto útil menos el dock (≈100) y la
    // barra superior (≈56), que es lo que obligó a encogerla.
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
