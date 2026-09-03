/* -------------------------------------------------------------------------- */
/*  Una prueba de tamaño de pantalla que espía `useWindowDimensions` NO prueba  */
/*  nada.                                                                      */
/*                                                                            */
/*  COSTE REAL (3/9/2026). La rama `pantalla` traía dos pruebas tituladas «se   */
/*  adapta correctamente al viewport de un teléfono móvil estrecho (< 380)» y  */
/*  «... apaisado de tableta (>= 850)». Las dos montaban la pantalla con       */
/*  `jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue(...)` y    */
/*  pasaban. Medido con una sonda: el espía se llamaba CERO veces y el árbol   */
/*  renderizado seguía trayendo la mascota de 260 px —la rama de escritorio—   */
/*  en el test que decía medir 360 px. Pasaban porque sólo comprobaban que     */
/*  tres cadenas del catálogo estuvieran presentes, cosa que ocurre en         */
/*  cualquier tamaño. Dos casos en verde que no cubrían ningún corte.          */
/*                                                                            */
/*  Es la regla 3 con otra ropa: un mock que no respeta el contrato de lo que  */
/*  imita valida la suposición del autor, no el comportamiento. Y es peor que  */
/*  no tener prueba, porque el nombre del caso afirma una cobertura que no     */
/*  existe.                                                                    */
/*                                                                            */
/*  QUÉ HACER EN SU LUGAR: sacar los cortes a una función pura y medirla con   */
/*  números —`computeStageLayout` en la bienvenida, `computeLuaLayout` en la   */
/*  presentación de Lúa—. Si además hace falta renderizar en un tamaño         */
/*  concreto, `jest.mock('react-native', ...)` en el propio fichero SÍ llega   */
/*  al componente; el espía sobre el espacio de nombres, no.                   */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', 'src');

/** Todos los ficheros de prueba bajo `src/`. */
function testFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(full);
    return /\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/* `jest.spyOn(<lo que sea>, 'useWindowDimensions')`, con o sin saltos de línea. */
const SPY = /spyOn\s*\([^)]*['"]useWindowDimensions['"]/s;

/* Los comentarios NO cuentan: este mismo aviso, y el de `luaLayout.test.ts`,
 * citan el patrón prohibido para explicarlo. Sin quitarlos, la guarda se
 * dispararía contra su propia documentación. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('ninguna prueba espía useWindowDimensions sobre el módulo', () => {
  const files = testFiles(SRC);

  it('encuentra ficheros de prueba que auditar', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map(f => [path.relative(SRC, f), f]))('%s', (_rel, file) => {
    const source = stripComments(fs.readFileSync(file, 'utf8'));
    expect(SPY.test(source)).toBe(false);
  });
});
