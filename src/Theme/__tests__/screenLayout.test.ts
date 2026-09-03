/* -------------------------------------------------------------------------- */
/*  Los cortes de tamaño, medidos con números.                                 */
/*                                                                            */
/*  Esta prueba nace de dos que NO comprobaban nada. Montaban la presentación  */
/*  de Lúa con `jest.spyOn(ReactNative, 'useWindowDimensions')` y afirmaban en */
/*  el título «< 380» y «>= 850»; medido con una sonda, el espía se llamaba    */
/*  CERO veces y las dos renderizaban el mismo viewport por defecto. Pasaban   */
/*  porque sólo miraban que tres cadenas del catálogo estuvieran presentes,    */
/*  cosa que ocurre en cualquier tamaño.                                      */
/*                                                                            */
/*  Aquí se mide la función pura, como en `bienvenidaLayout.test.tsx`.         */
/* -------------------------------------------------------------------------- */
import { computeScreenLayout } from '../screenLayout';

describe('computeScreenLayout', () => {
  it('tableta apaisada: dos columnas y cromo completo', () => {
    const l = computeScreenLayout({ winW: 1024, winH: 768 });

    expect(l.isTabletLandscape).toBe(true);
    expect(l.twoColumns).toBe(true);
    expect(l.isMobile).toBe(false);
    expect(l.isSmallPhone).toBe(false);
  });

  it('tableta en vertical: sigue habiendo sitio para dos columnas a partir de 960', () => {
    expect(computeScreenLayout({ winW: 1024, winH: 1366 }).twoColumns).toBe(true);
    // Una tableta estrecha en vertical NO: 820 px de ancho en una columna.
    expect(computeScreenLayout({ winW: 820, winH: 1180 }).twoColumns).toBe(false);
  });

  it('móvil en vertical: una columna y cromo compacto', () => {
    const l = computeScreenLayout({ winW: 360, winH: 740 });

    expect(l.twoColumns).toBe(false);
    expect(l.isMobile).toBe(true);
    expect(l.isSmallPhone).toBe(true);
  });

  it('móvil ancho en vertical: compacto, pero sin llegar a la talla mínima', () => {
    const l = computeScreenLayout({ winW: 412, winH: 892 });

    expect(l.isMobile).toBe(true);
    expect(l.isSmallPhone).toBe(false);
    expect(l.twoColumns).toBe(false);
  });

  it('MÓVIL APAISADO: dos columnas, pero con el cromo compacto, no el de escritorio', () => {
    // 740 × 360 mide más de 600 px de ancho: con el corte por ancho a secas
    // entraba en dos columnas con tipografías, iconos y rellenos de escritorio
    // dentro de 360 px de alto.
    const l = computeScreenLayout({ winW: 740, winH: 360 });

    expect(l.isMobileLandscape).toBe(true);
    expect(l.twoColumns).toBe(true);
    expect(l.isMobile).toBe(true);
    expect(l.isTabletLandscape).toBe(false);
  });

  it('una tableta apaisada NUNCA es «móvil apaisado»', () => {
    // Los dos cortes se solapan por alto; el de tableta manda.
    const l = computeScreenLayout({ winW: 1180, winH: 480 });

    expect(l.isTabletLandscape).toBe(true);
    expect(l.isMobileLandscape).toBe(false);
    expect(l.isMobile).toBe(false);
  });
});
