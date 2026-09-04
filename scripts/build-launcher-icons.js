#!/usr/bin/env node
/* -------------------------------------------------------------------------- */
/*  Iconos de lanzador de Android, generados desde la geometría del isotipo.   */
/*                                                                            */
/*  Uso:  node scripts/build-launcher-icons.js            (reescribe)          */
/*        node scripts/build-launcher-icons.js --check    (gate: no toca nada) */
/*                                                                            */
/*  COSTE REAL (4/9/2026). Frank: «el icono no se ve completo, se ve cortado y */
/*  agrandado». No era impresión suya y no era el dibujo: era la ZONA SEGURA.  */
/*  Un icono adaptativo se declara sobre un lienzo de 108 dp del que el        */
/*  lanzador solo garantiza el círculo CENTRAL DE 66 dp — el resto se lo come  */
/*  la máscara (círculo, cuadrado redondeado, «squircle»…) y el desplazamiento */
/*  de paralaje. El `ic_launcher_foreground.png` que había medía 292 px de     */
/*  ancho de contenido sobre 432 de lienzo: 73 dp. O sea, 7 dp MÁS ANCHO que   */
/*  la zona segura y más ancho incluso que la ventana visible de 72 dp. Las    */
/*  barras de los extremos y el «+» caían fuera por diseño, en cualquier       */
/*  lanzador, y el conjunto se veía enorme porque estaba pensado a sangre.     */
/*                                                                            */
/*  Aquí el tamaño no se elige a ojo: se calcula. Se mide el punto del dibujo  */
/*  más lejano del centro (`isotypeMaxRadius()`, que sale de la geometría, no  */
/*  de un número escrito a mano) y se escala para que ese punto quede dentro   */
/*  del círculo seguro con margen. `scripts/__tests__/launcherIcons.test.js`   */
/*  lo comprueba sobre los PNG ya escritos, píxel a píxel.                    */
/*                                                                            */
/*  Sin dependencias ni navegador: rasteriza a mano con supermuestreo 4× y     */
/*  escribe con el códec de `scripts/lib/png.js`. Es a propósito — el gráfico  */
/*  destacado de Play y el manual necesitan Chromium y por eso solo se         */
/*  regeneran a mano; un icono tiene que poder reconstruirse y comprobarse en  */
/*  CI sin navegador.                                                          */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const { decodePng, encodePng } = require('./lib/png');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

/* ---------------------------------------------------------------------------
 * Isotipo VIA+ — réplica de `src/Components/Common/ViaIcon.tsx`, en su misma
 * tesela de 150. Si allí cambian las barras, cambian aquí: es el mismo dibujo,
 * y `docs/play-store/build-feature-graphic.js` ya replicaba estos números.
 * ------------------------------------------------------------------------- */
const TILE = 150;
const BARS = [26, 46, 74, 100, 74, 46, 26];
const BAR_W = 9;
const GAP = 9;
const BAR_RX = 4.5;
const START_X = (TILE - (BARS.length * BAR_W + (BARS.length - 1) * GAP)) / 2; // 16.5
const CENTER_Y = TILE / 2;

const PLUS_CX = 116;
const PLUS_CY = 36;
const PLUS_ARM = 22;
const PLUS_W = 7;

/** Gradiente de marca (mismos topes que ViaIcon y que el fondo adaptativo). */
const GRADIENT = [
  { at: 0, rgb: [0xfd, 0xb3, 0x5c] },
  { at: 0.46, rgb: [0xff, 0x8a, 0x1e] },
  { at: 1, rgb: [0xe8, 0x5f, 0x12] },
];

/** Las piezas del dibujo, como rectángulos redondeados de la tesela de 150. */
function isotypeShapes() {
  const shapes = BARS.map((h, i) => ({
    x: START_X + i * (BAR_W + GAP),
    y: CENTER_Y - h / 2,
    w: BAR_W,
    h,
    r: BAR_RX,
  }));
  shapes.push({
    x: PLUS_CX - PLUS_ARM / 2,
    y: PLUS_CY - PLUS_W / 2,
    w: PLUS_ARM,
    h: PLUS_W,
    r: PLUS_W / 2,
  });
  shapes.push({
    x: PLUS_CX - PLUS_W / 2,
    y: PLUS_CY - PLUS_ARM / 2,
    w: PLUS_W,
    h: PLUS_ARM,
    r: PLUS_W / 2,
  });
  return shapes;
}

/**
 * Distancia del centro de la tesela al punto más lejano del DIBUJO.
 *
 * Se calcula sobre las esquinas redondeadas de cada pieza, no sobre la caja
 * que las envuelve: la caja mide 117 × 100 y su esquina está vacía —las barras
 * de los extremos son las cortas—, así que usarla encogería el icono de más.
 * Hoy el punto más lejano es el brazo del «+», a ~65,7 de un centro en 75.
 */
function isotypeMaxRadius() {
  let max = 0;
  for (const s of isotypeShapes()) {
    for (const [cx, cy] of [
      [s.x + s.r, s.y + s.r],
      [s.x + s.w - s.r, s.y + s.r],
      [s.x + s.r, s.y + s.h - s.r],
      [s.x + s.w - s.r, s.y + s.h - s.r],
    ]) {
      max = Math.max(max, Math.hypot(cx - TILE / 2, cy - TILE / 2) + s.r);
    }
  }
  return max;
}

/* ---------------------------------------------------------------------------
 * Rasterizador: cobertura por supermuestreo. Nada de curvas de Bézier — todo
 * el isotipo son rectángulos redondeados y círculos.
 * ------------------------------------------------------------------------- */
const SS = 4;

const inRoundedRect = (px, py, s) => {
  const rx = Math.min(s.r, s.w / 2);
  const ry = Math.min(s.r, s.h / 2);
  if (px < s.x || px > s.x + s.w || py < s.y || py > s.y + s.h) return false;
  const dx = Math.max(s.x + rx - px, px - (s.x + s.w - rx), 0);
  const dy = Math.max(s.y + ry - py, py - (s.y + s.h - ry), 0);
  return dx === 0 || dy === 0 || (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
};

const inCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) <= r;

/** Color del gradiente en la diagonal, como el `x1=0 y1=0 → x2=1 y2=1` del SVG. */
function gradientAt(t) {
  for (let i = 1; i < GRADIENT.length; i++) {
    const a = GRADIENT[i - 1];
    const b = GRADIENT[i];
    if (t <= b.at) {
      const k = (t - a.at) / (b.at - a.at);
      return a.rgb.map((c, j) => Math.round(c + (b.rgb[j] - c) * k));
    }
  }
  return GRADIENT[GRADIENT.length - 1].rgb;
}

/** Lienzo RGBA de `size × size` con acumulación en supermuestreo. */
function canvas(size) {
  const n = size * SS;
  const buf = new Float64Array(n * n * 4); // r,g,b premultiplicados + a

  const blend = (i, rgb, a) => {
    const inv = 1 - a;
    buf[i] = buf[i] * inv + rgb[0] * a;
    buf[i + 1] = buf[i + 1] * inv + rgb[1] * a;
    buf[i + 2] = buf[i + 2] * inv + rgb[2] * a;
    buf[i + 3] = buf[i + 3] * inv + a;
  };

  return {
    size,
    /** Pinta lo que `test(x, y)` declare dentro, en coordenadas de la tesela. */
    paint(test, color, alpha = 1, scale = 1, offset = 0) {
      for (let sy = 0; sy < n; sy++) {
        const ty = ((sy + 0.5) / SS - offset) / scale;
        for (let sx = 0; sx < n; sx++) {
          const tx = ((sx + 0.5) / SS - offset) / scale;
          if (!test(tx, ty)) continue;
          const i = (sy * n + sx) * 4;
          const rgb = typeof color === 'function' ? color(tx, ty) : color;
          const a = typeof alpha === 'function' ? alpha(tx, ty) : alpha;
          if (a > 0) blend(i, rgb, a);
        }
      }
    },
    /** Reduce el supermuestreo a la resolución final (media de área). */
    toRgba() {
      const out = Buffer.alloc(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          for (let dy = 0; dy < SS; dy++) {
            for (let dx = 0; dx < SS; dx++) {
              const i = ((y * SS + dy) * n + x * SS + dx) * 4;
              r += buf[i];
              g += buf[i + 1];
              b += buf[i + 2];
              a += buf[i + 3];
            }
          }
          const m = SS * SS;
          const o = (y * size + x) * 4;
          out[o] = Math.round(r / m);
          out[o + 1] = Math.round(g / m);
          out[o + 2] = Math.round(b / m);
          out[o + 3] = Math.round((a / m) * 255);
        }
      }
      return out;
    },
  };
}

/** Dibuja el isotipo (barras + «+») con el color dado. */
function paintIsotype(c, color, scale, offset) {
  const shapes = isotypeShapes();
  c.paint(
    (x, y) => shapes.some(s => inRoundedRect(x, y, s)),
    color,
    0.96,
    scale,
    offset,
  );
}

/* ---------------------------------------------------------------------------
 * Las cuatro piezas.
 * ------------------------------------------------------------------------- */

/** Zona segura del icono adaptativo: círculo de 66 dp sobre lienzo de 108 dp. */
const ADAPTIVE_CANVAS_DP = 108;
const SAFE_ZONE_DP = 66;
/** Margen óptico dentro de la zona segura (el dibujo no llega a rozarla). */
const SAFE_MARGIN = 0.96;

/** Escala del isotipo dentro del lienzo adaptativo, en unidades de tesela. */
function adaptiveScale(sizePx) {
  const dp = sizePx / ADAPTIVE_CANVAS_DP; // px por dp
  const safeRadiusPx = (SAFE_ZONE_DP / 2) * dp * SAFE_MARGIN;
  return safeRadiusPx / isotypeMaxRadius();
}

/** Capa de primer plano del icono adaptativo: isotipo blanco, resto transparente. */
function foreground(sizePx, color) {
  const c = canvas(sizePx);
  const scale = adaptiveScale(sizePx);
  const offset = sizePx / 2 - (TILE / 2) * scale;
  paintIsotype(c, color, scale, offset);
  return c.toRgba();
}

/** Icono heredado (API 24-25 y tiendas): tesela de marca completa. */
function legacyIcon(sizePx, { round }) {
  const c = canvas(sizePx);
  const k = sizePx / TILE;
  const tile = { x: 0, y: 0, w: TILE, h: TILE, r: 42 };

  const dentro = round
    ? (x, y) => inCircle(x, y, TILE / 2, TILE / 2, TILE / 2)
    : (x, y) => inRoundedRect(x, y, tile);

  // Fondo de marca.
  c.paint(dentro, (x, y) => gradientAt(Math.min(1, (x + y) / (2 * TILE))), 1, k, 0);
  // Brillo superior, como el `gloss` de ViaIcon.
  c.paint(
    (x, y) => dentro(x, y) && y <= 81,
    [255, 255, 255],
    (_x, y) => 0.32 * (1 - y / 81),
    k,
    0,
  );

  /* En la versión redonda el dibujo encoge: la tesela cuadrada le deja las
   * esquinas y el círculo no. 0,82 deja ~14 % de margen al punto más lejano. */
  const inner = round ? 0.82 : 1;
  const scale = k * inner;
  const offset = sizePx / 2 - (TILE / 2) * scale;
  paintIsotype(c, [255, 255, 255], scale, offset);

  return c.toRgba();
}

/* ---------------------------------------------------------------------------
 * Salidas por densidad.
 * ------------------------------------------------------------------------- */
const DENSITIES = [
  { dir: 'mdpi', legacy: 48, adaptive: 108 },
  { dir: 'hdpi', legacy: 72, adaptive: 162 },
  { dir: 'xhdpi', legacy: 96, adaptive: 216 },
  { dir: 'xxhdpi', legacy: 144, adaptive: 324 },
  { dir: 'xxxhdpi', legacy: 192, adaptive: 432 },
];

function build() {
  const files = [];
  for (const d of DENSITIES) {
    const dir = path.join(RES, `mipmap-${d.dir}`);
    files.push(
      {
        file: path.join(dir, 'ic_launcher.png'),
        size: d.legacy,
        rgba: legacyIcon(d.legacy, { round: false }),
      },
      {
        file: path.join(dir, 'ic_launcher_round.png'),
        size: d.legacy,
        rgba: legacyIcon(d.legacy, { round: true }),
      },
      {
        file: path.join(dir, 'ic_launcher_foreground.png'),
        size: d.adaptive,
        rgba: foreground(d.adaptive, [255, 255, 255]),
      },
      /* Capa monocroma (Android 13+, iconos temáticos): el sistema la tiñe con
       * el color del tema y solo mira el alfa, así que va en negro plano. */
      {
        file: path.join(dir, 'ic_launcher_monochrome.png'),
        size: d.adaptive,
        rgba: foreground(d.adaptive, [0, 0, 0]),
      },
    );
  }
  return files;
}

function main() {
  const check = process.argv.includes('--check');
  const files = build();
  const distintos = [];

  for (const f of files) {
    const png = encodePng(f.rgba, f.size, f.size);
    const rel = path.relative(ROOT, f.file);
    if (check) {
      if (!fs.existsSync(f.file)) {
        distintos.push(`${rel} — no existe`);
        continue;
      }
      const actual = decodePng(fs.readFileSync(f.file));
      if (actual.width !== f.size || !actual.rgba.equals(f.rgba)) {
        distintos.push(rel);
      }
    } else {
      fs.mkdirSync(path.dirname(f.file), { recursive: true });
      fs.writeFileSync(f.file, png);
    }
  }

  const radio = isotypeMaxRadius();
  const anchoDp = ((SAFE_ZONE_DP / 2) * SAFE_MARGIN * 2 * (117 / 2)) / radio;

  if (check) {
    if (distintos.length) {
      console.error(
        'Los iconos del lanzador no coinciden con el generador:\n  ' +
          distintos.join('\n  ') +
          '\n\nRegenéralos con `node scripts/build-launcher-icons.js`.',
      );
      process.exit(1);
    }
    console.log(`✓ ${files.length} iconos al día (dibujo de ${anchoDp.toFixed(1)} dp de ancho).`);
    return;
  }

  console.log(
    `${files.length} iconos escritos · dibujo de ${anchoDp.toFixed(1)} dp de ancho, ` +
      `dentro del círculo seguro de ${SAFE_ZONE_DP} dp.`,
  );
}

/* Solo cuando se ejecuta como herramienta: `require`-lo desde una prueba NO
 * puede reescribir 20 PNG como efecto secundario. */
if (require.main === module) main();

module.exports = { isotypeMaxRadius, adaptiveScale, ADAPTIVE_CANVAS_DP, SAFE_ZONE_DP, SAFE_MARGIN };
