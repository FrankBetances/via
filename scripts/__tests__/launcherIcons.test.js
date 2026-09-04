/* -------------------------------------------------------------------------- */
/*  El icono del lanzador cabe dentro de la ZONA SEGURA.                       */
/*                                                                            */
/*  COSTE REAL (4/9/2026). Frank: «el icono no se ve completo, se ve cortado y */
/*  agrandado». Cierto, y no era el dibujo: un icono adaptativo se declara     */
/*  sobre 108 dp de lienzo de los que el lanzador solo GARANTIZA el círculo    */
/*  central de 66 dp; el resto se lo llevan la máscara —círculo, «squircle»,   */
/*  cuadrado redondeado, cada fabricante la suya— y el desplazamiento de       */
/*  paralaje. El primer plano que había medía 292 px de dibujo sobre 432 de    */
/*  lienzo: 73 dp, siete más que la zona segura y uno más que la propia        */
/*  ventana visible de 72 dp. Las barras de los extremos y el «+» se perdían   */
/*  SIEMPRE, en cualquier lanzador.                                            */
/*                                                                            */
/*  Nada de lo que ya había podía verlo: ni `tsc`, ni las suites de JS, ni el  */
/*  bundle, ni el APK firmado. Un icono mal encajado compila perfectamente.    */
/*  Por eso la comprobación se hace aquí y sobre los PNG COMMITEADOS, no sobre */
/*  lo que el generador diga que produce.                                      */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const { decodePng } = require('../lib/png');
const {
  ADAPTIVE_CANVAS_DP,
  SAFE_ZONE_DP,
} = require('../build-launcher-icons');

const RES = path.resolve(__dirname, '..', '..', 'android', 'app', 'src', 'main', 'res');

const DENSIDADES = [
  { dir: 'mdpi', legacy: 48, adaptive: 108 },
  { dir: 'hdpi', legacy: 72, adaptive: 162 },
  { dir: 'xhdpi', legacy: 96, adaptive: 216 },
  { dir: 'xxhdpi', legacy: 144, adaptive: 324 },
  { dir: 'xxxhdpi', legacy: 192, adaptive: 432 },
];

/** Punto opaco más lejano del centro, en dp del lienzo de 108. */
function radioDelDibujoEnDp(file) {
  const { width, height, rgba } = decodePng(fs.readFileSync(file));
  const cx = width / 2;
  const cy = height / 2;
  let max = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Alfa > 8 y no un resto de antialias suelto: lo que se ve, se cuenta.
      if (rgba[(y * width + x) * 4 + 3] > 8) {
        max = Math.max(max, Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
      }
    }
  }
  return (max * ADAPTIVE_CANVAS_DP) / width;
}

describe('iconos del lanzador', () => {
  it.each(DENSIDADES.map(d => [d.dir, d]))(
    'mipmap-%s trae las cuatro piezas con su tamaño',
    (_dir, d) => {
      const dir = path.join(RES, `mipmap-${d.dir}`);
      const esperado = {
        'ic_launcher.png': d.legacy,
        'ic_launcher_round.png': d.legacy,
        'ic_launcher_foreground.png': d.adaptive,
        'ic_launcher_monochrome.png': d.adaptive,
      };
      for (const [nombre, lado] of Object.entries(esperado)) {
        const file = path.join(dir, nombre);
        expect(fs.existsSync(file)).toBe(true);
        const { width, height } = decodePng(fs.readFileSync(file));
        expect([width, height]).toEqual([lado, lado]);
      }
    },
  );

  it.each(DENSIDADES.map(d => [d.dir, d]))(
    'mipmap-%s: el primer plano NO se sale del círculo seguro de 66 dp',
    (_dir, d) => {
      for (const capa of ['ic_launcher_foreground.png', 'ic_launcher_monochrome.png']) {
        const radio = radioDelDibujoEnDp(path.join(RES, `mipmap-${d.dir}`, capa));
        // El valor que tenía el icono roto era ~36,5 dp de radio; el límite es 33.
        expect(radio).toBeLessThanOrEqual(SAFE_ZONE_DP / 2);
        // Y que no se haya encogido hasta desaparecer: un dibujo por debajo de
        // 24 dp de diámetro se ve perdido dentro de la tesela.
        expect(radio).toBeGreaterThan(12);
      }
    },
  );

  it('el icono adaptativo declara fondo, primer plano y capa monocroma', () => {
    for (const xml of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      const s = fs.readFileSync(path.join(RES, 'mipmap-anydpi-v26', xml), 'utf8');
      expect(s).toContain('<background android:drawable="@drawable/ic_launcher_background"');
      expect(s).toContain('<foreground android:drawable="@mipmap/ic_launcher_foreground"');
      // Android 13+ tiñe esta capa con el color del tema; sin ella el icono se
      // queda fuera de los iconos temáticos y el sistema pinta un genérico.
      expect(s).toContain('<monochrome android:drawable="@mipmap/ic_launcher_monochrome"');
    }
  });

  it('el manifiesto declara el icono y su variante redonda', () => {
    const manifest = fs.readFileSync(
      path.resolve(RES, '..', 'AndroidManifest.xml'),
      'utf8',
    );
    expect(manifest).toContain('android:icon="@mipmap/ic_launcher"');
    expect(manifest).toContain('android:roundIcon="@mipmap/ic_launcher_round"');
  });
});
