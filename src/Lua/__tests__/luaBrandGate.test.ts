/* -------------------------------------------------------------------------- */
/*  Gate de la mascota vendorizada, dentro de la suite.                         */
/*                                                                             */
/*  Corre `scripts/check-lua-brand.js` como test para que no dependa de que        */
/*  alguien se acuerde de invocarlo. Vigila dos cosas: que el sprite copiado de   */
/*  Valeria+ no se edite AQUÍ —si se edita, la cara de la app y la del aparato se  */
/*  separan versión a versión— y que no entre marca de la mascota retirada.       */
/*                                                                             */
/*  Y respeta la distinción del gate original: «oso» es vocabulario terapéutico   */
/*  legítimo en este repositorio (par mínimo ocho/oso, órdenes TPR, `hartza`).    */
/*  Lo que se persigue es MARCA, no contenido.                                   */
/* -------------------------------------------------------------------------- */

export {};

declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT: string = path.resolve(__dirname, '..', '..', '..');
const VENDOR: string = path.join(ROOT, 'src', 'Lua', 'vendor', 'ValeriaCatPixel.tsx');

describe('la mascota vendorizada', () => {
  it('pasa el gate de marca', () => {
    // Falla con el stderr del script, que ya explica qué hacer.
    expect(() =>
      execFileSync('node', [path.join(ROOT, 'scripts', 'check-lua-brand.js')], { encoding: 'utf8' }),
    ).not.toThrow();
  });

  it('declara su origen y prohíbe editarla aquí', () => {
    const header: string = fs.readFileSync(VENDOR, 'utf8').split('\n').slice(0, 19).join('\n');
    expect(header).toContain('VENDORIZADO');
    expect(header).toContain('FrankBetances/Valeria');
    expect(header).toContain('NO EDITAR AQUÍ');
  });

  it('el manifiesto fija el commit de origen', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'src', 'Lua', 'vendor', 'origen.json'), 'utf8'),
    );
    expect(manifest.upstreamCommitFull).toMatch(/^[0-9a-f]{40}$/);
    expect(manifest.bodySha256).toMatch(/^[0-9a-f]{64}$/);
    // El cuerpo vendorizado tiene que ser el fichero original íntegro.
    expect(manifest.bodySha256).toBe(manifest.originalSha256);
  });

  it('solo necesita react-native-svg, que VIA+ ya tiene', () => {
    // Si una sincronización trajera una dependencia nueva, el bundle se rompería
    // en tiempo de ejecución y no al compilar. Mejor verlo aquí.
    const body: string = fs.readFileSync(VENDOR, 'utf8');
    const imports: string[] = [...body.matchAll(/from '([^']+)'/g)].map((m: any) => m[1]);
    expect(new Set(imports)).toEqual(new Set(['react', 'react-native-svg']));
  });

  it('no arrastra nada de la mascota retirada', () => {
    const body: string = fs.readFileSync(VENDOR, 'utf8');
    expect(body).not.toMatch(/BearMark|DistractorBear|Oso\s+Distractor/i);
  });
});
