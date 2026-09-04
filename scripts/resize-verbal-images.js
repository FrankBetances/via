#!/usr/bin/env node
/* eslint-env node */
/**
 * Ajusta las ilustraciones de la Audiometría Verbal al lado que la app DIBUJA
 * (herramienta de desarrollo + gate de CI).
 *
 *   node scripts/resize-verbal-images.js            → redimensiona in situ
 *   node scripts/resize-verbal-images.js --check    → solo comprueba (CI)
 *   node scripts/resize-verbal-images.js --dry-run  → informa sin escribir
 *   node scripts/resize-verbal-images.js --side 256 → otro lado objetivo
 *
 * POR QUÉ EXISTE
 * Un PNG no ocupa en memoria lo que ocupa en disco: React Native lo
 * descomprime a un bitmap RGBA, y ese bitmap cuesta `ancho × alto × 4` bytes
 * pase lo que pase con la compresión. Las ilustraciones se generaban a
 * 512×512 — 1,0 MB de RAM cada una, 97 MB si se descomprimieran las 97 — y
 * `WordCard` las dibuja a 72–96 pt (`imgSide`, WordCard.tsx). Incluso en una
 * pantalla @3x, 96 pt son 288 px físicos: más de la mitad de cada bitmap era
 * detalle que no llega a ningún píxel de la pantalla.
 *
 * 288 = 96 pt × 3 (la densidad más alta que sirve la app). No se elige más
 * bajo porque entonces sí se vería: es el punto exacto en el que se deja de
 * pagar RAM sin perder nitidez.
 *
 * ESTO NO ES UN PASO DEL PIPELINE, ES UNA CORRECCIÓN DE UNA SOLA VEZ.
 * El generador (`verbal-assets.js images`) ya produce el lado correcto. Este
 * script existe para (a) corregir los assets que se generaron a 512 antes de
 * ese cambio y (b) impedir en CI, con `--check`, que vuelva a colarse un
 * asset sobredimensionado — incluido el banco definitivo del ilustrador, que
 * llegará por fuera del generador.
 *
 * Sin dependencias externas a propósito: decodifica y reencodea PNG con el
 * `zlib` de Node. El banco es uniforme (8 bits, RGBA, sin entrelazar) y el
 * script se niega a tocar cualquier PNG que no lo sea, en vez de adivinar.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** Lado objetivo: 96 pt (`imgSide` mayor de WordCard) × 3 de densidad @3x. */
const DEFAULT_SIDE = 288;

/** Directorios del banco de ilustraciones (el base y el de cada variante). */
const DEFAULT_DIR = path.join(ROOT, 'assets', 'img', 'verbal');

const { readHeader, decodePng, encodePng } = require('./lib/png');

/**
 * Reducción por MEDIA DE ÁREA, sobre color PREMULTIPLICADO por alfa.
 *
 * Lo de premultiplicar no es un refinamiento: estas ilustraciones se generan
 * con `omitBackground`, así que fuera del dibujo hay píxeles con alfa 0 cuyo
 * RGB es negro. Promediando el RGB a secas, cada píxel del borde se mezcla
 * con esos negros invisibles y el resultado es una orla oscura alrededor del
 * pictograma. Premultiplicar hace que un píxel transparente aporte color en
 * la proporción en que se ve, que es cero.
 */
function resizeRgba(src, width, height, side) {
  const dst = Buffer.alloc(side * side * 4);
  const ratioX = width / side;
  const ratioY = height / side;

  for (let dy = 0; dy < side; dy++) {
    const sy0 = dy * ratioY;
    const sy1 = sy0 + ratioY;
    const iy0 = Math.floor(sy0);
    const iy1 = Math.min(height, Math.ceil(sy1));

    for (let dx = 0; dx < side; dx++) {
      const sx0 = dx * ratioX;
      const sx1 = sx0 + ratioX;
      const ix0 = Math.floor(sx0);
      const ix1 = Math.min(width, Math.ceil(sx1));

      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;
      let accW = 0;

      for (let y = iy0; y < iy1; y++) {
        const weightY = Math.min(y + 1, sy1) - Math.max(y, sy0);
        if (weightY <= 0) continue;
        for (let x = ix0; x < ix1; x++) {
          const weightX = Math.min(x + 1, sx1) - Math.max(x, sx0);
          if (weightX <= 0) continue;
          const weight = weightX * weightY;
          const o = (y * width + x) * 4;
          const alpha = src[o + 3] / 255;
          accR += src[o] * alpha * weight;
          accG += src[o + 1] * alpha * weight;
          accB += src[o + 2] * alpha * weight;
          accA += src[o + 3] * weight;
          accW += weight;
        }
      }

      const o = (dy * side + dx) * 4;
      const alpha = accA / accW;
      const factor = alpha / 255;
      const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : v);
      dst[o] = factor > 0 ? clamp(Math.round(accR / accW / factor)) : 0;
      dst[o + 1] = factor > 0 ? clamp(Math.round(accG / accW / factor)) : 0;
      dst[o + 2] = factor > 0 ? clamp(Math.round(accB / accW / factor)) : 0;
      dst[o + 3] = clamp(Math.round(alpha));
    }
  }

  return dst;
}

/* --------------------------------- CLI ----------------------------------- */

function collectPngs(dir) {
  const out = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith('.png')) out.push(full);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
}

const mb = bytes => (bytes / 1048576).toFixed(1);
const rel = file => path.relative(ROOT, file);

function main() {
  const argv = process.argv.slice(2);
  const flag = name => argv.includes(name);
  const value = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };

  const side = Number(value('--side', DEFAULT_SIDE));
  const dir = path.resolve(ROOT, value('--dir', DEFAULT_DIR));
  const check = flag('--check');
  const dryRun = flag('--dry-run');

  if (!Number.isInteger(side) || side <= 0) {
    console.error(`✖ --side inválido: ${value('--side', DEFAULT_SIDE)}`);
    process.exit(1);
  }

  const files = collectPngs(dir);
  if (!files.length) {
    console.error(`✖ No hay PNG en ${rel(dir)}`);
    process.exit(1);
  }

  /* ------------------------------- --check ------------------------------- */

  if (check) {
    const oversized = [];
    const unsupported = [];
    for (const file of files) {
      const header = readHeader(file);
      if (!header) {
        unsupported.push([file, 'no es un PNG legible']);
        continue;
      }
      if (header.depth !== 8 || header.colorType !== 6 || header.interlace !== 0) {
        unsupported.push([
          file,
          `depth=${header.depth} colorType=${header.colorType} interlace=${header.interlace}`,
        ]);
      }
      if (header.width > side || header.height > side) {
        oversized.push([file, `${header.width}×${header.height}`]);
      }
    }

    if (unsupported.length) {
      console.error(`\n✖ ${unsupported.length} ilustración(es) en un formato que este gate no sabe leer:`);
      for (const [file, why] of unsupported) console.error(`    ${rel(file)} — ${why}`);
      console.error('\n  El banco es PNG de 8 bits RGBA sin entrelazar. Reexporte el asset.\n');
      process.exit(1);
    }

    if (oversized.length) {
      const waste = oversized.reduce((sum, [file]) => {
        const h = readHeader(file);
        return sum + (h.width * h.height - side * side) * 4;
      }, 0);
      console.error(`\n✖ ${oversized.length} ilustración(es) por encima de ${side}×${side} px:`);
      for (const [file, size] of oversized) console.error(`    ${rel(file)} — ${size}`);
      console.error(
        `\n  React Native las descomprime a bitmap: son ${mb(waste)} MB de RAM que la\n` +
          `  pantalla no llega a usar (WordCard dibuja a 72–96 pt). Corríjalo con:\n` +
          `      node scripts/resize-verbal-images.js\n`,
      );
      process.exit(1);
    }

    const ram = files.reduce((sum, file) => {
      const h = readHeader(file);
      return sum + h.width * h.height * 4;
    }, 0);
    console.log(
      `${files.length} ilustraciones ≤ ${side}×${side} px · ${mb(ram)} MB de bitmap si se descomprimen todas`,
    );
    return;
  }

  /* ----------------------------- redimensionar ---------------------------- */

  let touched = 0;
  let skipped = 0;
  let diskBefore = 0;
  let diskAfter = 0;
  let ramBefore = 0;
  let ramAfter = 0;

  for (const file of files) {
    const before = fs.statSync(file).size;
    diskBefore += before;

    let image;
    try {
      image = decodePng(fs.readFileSync(file));
    } catch (e) {
      console.error(`\n✖ ${rel(file)}: ${e.message}\n`);
      process.exit(1);
    }

    ramBefore += image.width * image.height * 4;

    if (image.width <= side && image.height <= side) {
      skipped += 1;
      diskAfter += before;
      ramAfter += image.width * image.height * 4;
      continue;
    }

    if (image.width !== image.height) {
      console.error(
        `\n✖ ${rel(file)} no es cuadrada (${image.width}×${image.height}).\n` +
          '  Las tarjetas dibujan un cuadrado; reescalar sin recortar la deformaría.\n',
      );
      process.exit(1);
    }

    const resized = resizeRgba(image.rgba, image.width, image.height, side);
    const png = encodePng(resized, side, side);

    ramAfter += side * side * 4;
    diskAfter += png.length;
    touched += 1;

    if (!dryRun) fs.writeFileSync(file, png);
    process.stdout.write('.');
  }

  const verb = dryRun ? 'se redimensionarían' : 'redimensionadas';
  console.log(
    `\n${touched} ${verb} a ${side}×${side}` + (skipped ? ` · ${skipped} ya estaban en tamaño` : ''),
  );
  console.log(`  disco  ${mb(diskBefore)} MB → ${mb(diskAfter)} MB`);
  console.log(
    `  bitmap ${mb(ramBefore)} MB → ${mb(ramAfter)} MB` +
      (ramBefore > 0 ? `  (−${Math.round((1 - ramAfter / ramBefore) * 100)} %)` : ''),
  );
  if (dryRun) console.log('  (--dry-run: no se ha escrito nada)');
}

main();
