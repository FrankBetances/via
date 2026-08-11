/* -------------------------------------------------------------------------- */
/*  El gate de la mascota, también dentro de la suite.                          */
/*                                                                             */
/*  `scripts/check-lua-sprite.js` compara el DIBUJO de Lúa con el de Valeria+     */
/*  —las dos rejillas y la paleta, hasheadas— y está cableado en                  */
/*  `android-release.yml`. El problema de vivir solo ahí es que ese workflow corre */
/*  al publicar: un dibujo retocado en VIA+ pasaría desapercibido durante todo el  */
/*  desarrollo y saltaría en el peor momento. Aquí se ejecuta en cada `npm test`.  */
/*                                                                             */
/*  Y se comprueba que el paso de CI siga existiendo, porque un gate que alguien   */
/*  quita de un workflow no deja ningún rastro rojo.                              */
/* -------------------------------------------------------------------------- */

export {};

declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT: string = path.resolve(__dirname, '..', '..', '..');

describe('la mascota no se edita en VIA+', () => {
  it('el dibujo coincide con el de Valeria+', () => {
    // Si falla, el stderr del script ya explica qué hacer: se edita en Valeria+,
    // se corre allí `npm run build:brand` y se vuelve a copiar el fichero entero.
    expect(() =>
      execFileSync('node', [path.join(ROOT, 'scripts', 'check-lua-sprite.js')], { encoding: 'utf8' }),
    ).not.toThrow();
  });

  it('el gate sigue cableado en el workflow de release', () => {
    const wf: string = fs.readFileSync(
      path.join(ROOT, '.github', 'workflows', 'android-release.yml'),
      'utf8',
    );
    expect(wf).toContain('scripts/check-lua-sprite.js');
  });

  it('la mascota declara que su fuente es Valeria+ y que no se toca aquí', () => {
    const sprite: string = fs.readFileSync(
      path.join(ROOT, 'src', 'Components', 'Mascot', 'LuaPixel.tsx'),
      'utf8',
    );
    expect(sprite).toContain('NO EDITAR AQUÍ');
    expect(sprite).toContain('FrankBetances/Valeria');
  });

  it('solo necesita react-native-svg, que VIA+ ya tiene', () => {
    // Si una sincronización futura trajera una dependencia nueva, el bundle se
    // rompería en ejecución y no al compilar. Mejor verlo aquí.
    const sprite: string = fs.readFileSync(
      path.join(ROOT, 'src', 'Components', 'Mascot', 'LuaPixel.tsx'),
      'utf8',
    );
    const imports: string[] = [...sprite.matchAll(/from '([^']+)'/g)].map((m: any) => m[1]);
    expect(new Set(imports)).toEqual(new Set(['react', 'react-native-svg']));
  });
});
