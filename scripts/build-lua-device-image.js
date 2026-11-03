#!/usr/bin/env node
/* -------------------------------------------------------------------------- *
 *  Imagen de Lúa en la pantalla «Conoce a Lúa» (PresentacionLua).
 *
 *    node scripts/build-lua-device-image.js [--firmware ../lua-firmware]
 *
 *  Hasta el 3/11/2026 la pantalla enseñaba una gata astronauta que no es Lúa.
 *  La Lúa de verdad es la V5 de `github.com/FrankBetances/lua-firmware`: cabeza
 *  cúbica, cuerpo-cubo con luz RGB y piezas de construcción. Este script toma
 *  sus tres renders con la luz encendida (`docs/cad/lua-v5/luz/{naranja,azul,
 *  verde}.png`, salidos de `tools/blender/render_v5.py`) y los deja listos
 *  para la app:
 *
 *    1. quita el fondo gris del estudio de Blender: relleno desde los bordes
 *       sobre píxeles grises neutros parecidos a su vecino, para no comerse
 *       nada del muñeco (la luz del cubo es cálida o fría, no gris);
 *    2. suaviza la silueta (alfa 3×3) para que no quede dentada;
 *    2b. aviva un poco el color (saturación ×1,15 y contraste ×1,05): el
 *        estudio gris de Blender lo apaga, y sobre el crema de la pantalla
 *        el muñeco quedaba lavado. Se mantiene el tono de cada pieza;
 *    3. recorta al muñeco, lo centra en un lienzo cuadrado transparente y
 *       redimensiona con el promedio premultiplicado de
 *       `resize-verbal-images.js` (sin orla oscura): 256 px y @2x 512 px.
 *
 *  Escribe `assets/img/lua_v5_luz.origen.json` con el commit del firmware y
 *  el SHA-256 de cada fuente y cada salida. `scripts/__tests__/
 *  luaDeviceImage.test.js` comprueba que las salidas no se tocaron a mano.
 *
 *  OJO: son RENDERS. Según el CLAUDE.md del firmware, la V5 está dibujada y
 *  medida, NO fabricada, y su cubo no tiene programa: hoy no se enciende.
 *  La pantalla lo dice en el pie de la imagen.
 * -------------------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const { decodePng, encodePng } = require('./lib/png');
const { resizeRgba } = require('./resize-verbal-images');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'img');
const COLORS = ['naranja', 'azul', 'verde'];
const SOURCE_REL = 'docs/cad/lua-v5/luz';
const SIZES = [
  { suffix: '', side: 256 },
  { suffix: '@2x', side: 512 },
];
const MARGIN = 0.04; // aire alrededor del muñeco, en fracción del lado

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

/** ¿Es fondo de estudio? Gris neutro, ni muy oscuro ni muy claro. */
const isGrey = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) <= 10 && r > 95 && r < 175;

function removeBackground(rgba, width, height) {
  const bg = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    const i = y * width + x;
    if (bg[i]) return;
    const o = i * 4;
    if (!isGrey(rgba[o], rgba[o + 1], rgba[o + 2])) return;
    bg[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i - x) / width;
    const o = i * 4;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = (ny * width + nx) * 4;
      // El fondo es un degradado suave: solo se avanza a un vecino parecido.
      const close =
        Math.abs(rgba[n] - rgba[o]) <= 6 && Math.abs(rgba[n + 1] - rgba[o + 1]) <= 6 && Math.abs(rgba[n + 2] - rgba[o + 2]) <= 6;
      if (close) push(nx, ny);
    }
  }
  // Alfa: 0 en el fondo, 255 en el muñeco, y una media 3×3 en la silueta.
  const out = Buffer.from(rgba);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          sum += bg[yy * width + xx] ? 0 : 255;
          n++;
        }
      }
      out[(y * width + x) * 4 + 3] = Math.round(sum / n);
    }
  }
  return out;
}

const SATURATION = 1.15;
const CONTRAST = 1.05;

/** Saturación y contraste moderados; el tono (matiz) de cada pieza no cambia. */
function enhance(rgba) {
  const out = Buffer.from(rgba);
  const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  for (let o = 0; o < out.length; o += 4) {
    if (out[o + 3] === 0) continue;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = c => l + (c - l) * SATURATION;
    const con = c => (c - 128) * CONTRAST + 128;
    out[o] = clamp(con(sat(r)));
    out[o + 1] = clamp(con(sat(g)));
    out[o + 2] = clamp(con(sat(b)));
  }
  return out;
}

function cropToSquare(rgba, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('no queda nada del muñeco tras quitar el fondo');
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.ceil(Math.max(w, h) * (1 + 2 * MARGIN));
  const dst = Buffer.alloc(side * side * 4); // transparente
  const ox = Math.floor((side - w) / 2);
  const oy = Math.floor((side - h) / 2);
  for (let y = 0; y < h; y++) {
    const from = ((minY + y) * width + minX) * 4;
    rgba.copy(dst, ((oy + y) * side + ox) * 4, from, from + w * 4);
  }
  return { rgba: dst, side, box: { x: minX, y: minY, w, h } };
}

function firmwareCommit(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  const fwIdx = args.indexOf('--firmware');
  const firmware = path.resolve(ROOT, fwIdx >= 0 ? args[fwIdx + 1] : '../lua-firmware');
  const sourceDir = path.join(firmware, SOURCE_REL);
  if (!fs.existsSync(sourceDir)) {
    console.error(`✗ No encuentro ${sourceDir}. Clona lua-firmware al lado de via o pasa --firmware.`);
    process.exit(1);
  }
  const origin = {
    fuente: 'github.com/FrankBetances/lua-firmware',
    commit: firmwareCommit(firmware),
    ruta: SOURCE_REL,
    generadoPor: 'scripts/build-lua-device-image.js',
    nota: 'Renders de diseño de Lúa V5: no es una foto de un aparato fabricado.',
    colores: {},
  };
  for (const color of COLORS) {
    const srcBuf = fs.readFileSync(path.join(sourceDir, `${color}.png`));
    const img = decodePng(srcBuf);
    const cut = removeBackground(img.rgba, img.width, img.height);
    const square = cropToSquare(enhance(cut), img.width, img.height);
    const entry = { fuenteSha256: sha(srcBuf), recorte: square.box, salidas: {} };
    for (const { suffix, side } of SIZES) {
      const png = encodePng(resizeRgba(square.rgba, square.side, square.side, side), side, side);
      const name = `lua_v5_luz_${color}${suffix}.png`;
      fs.writeFileSync(path.join(OUT_DIR, name), png);
      entry.salidas[name] = { lado: side, sha256: sha(png) };
      console.log(`✓ ${name} · ${side}×${side} · ${(png.length / 1024).toFixed(0)} KB`);
    }
    origin.colores[color] = entry;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'lua_v5_luz.origen.json'), `${JSON.stringify(origin, null, 2)}\n`);
  console.log(`✓ lua_v5_luz.origen.json · firmware ${origin.commit ?? '(sin git)'}`);
}

if (require.main === module) main();

module.exports = { isGrey, removeBackground, enhance, cropToSquare };
