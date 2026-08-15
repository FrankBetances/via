#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */
/* eslint-disable no-bitwise -- PNG se define a nivel de bit: CRC-32, filtros
 * por fila y empaquetado de canales. Escribir esto sin operadores de bits sería
 * traducir el formato a otra cosa. */
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
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

/** Lado objetivo: 96 pt (`imgSide` mayor de WordCard) × 3 de densidad @3x. */
const DEFAULT_SIDE = 288;

/** Directorios del banco de ilustraciones (el base y el de cada variante). */
const DEFAULT_DIR = path.join(ROOT, 'assets', 'img', 'verbal');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* --------------------------------- PNG ----------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

/**
 * Lee la cabecera sin descomprimir nada. Barato: `--check` recorre el banco
 * entero leyendo 33 bytes por fichero.
 */
function readHeader(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(33);
  const read = fs.readSync(fd, head, 0, 33, 0);
  fs.closeSync(fd);
  if (read < 33 || !head.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (head.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return {
    width: head.readUInt32BE(16),
    height: head.readUInt32BE(20),
    depth: head[24],
    colorType: head[25],
    interlace: head[28],
  };
}

/** PNG → { width, height, rgba }. Solo 8 bits / RGBA / sin entrelazar. */
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('no es un PNG');

  let pos = 8;
  let ihdr = null;
  const idat = [];

  while (pos + 8 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }

  if (!ihdr) throw new Error('PNG sin IHDR');
  if (ihdr.depth !== 8 || ihdr.colorType !== 6 || ihdr.interlace !== 0) {
    throw new Error(
      `formato no soportado (depth=${ihdr.depth} colorType=${ihdr.colorType} interlace=${ihdr.interlace}); ` +
        'este script solo trata PNG de 8 bits RGBA sin entrelazar',
    );
  }

  const { width, height } = ihdr;
  const bpp = 4;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error('IDAT incompleto');

  const rgba = Buffer.alloc(stride * height);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[src++];
      const a = x >= bpp ? rgba[row + x - bpp] : 0;
      const b = y > 0 ? rgba[prev + x] : 0;
      const c = x >= bpp && y > 0 ? rgba[prev + x - bpp] : 0;
      let out;
      switch (filter) {
        case 0: out = value; break;
        case 1: out = value + a; break;
        case 2: out = value + b; break;
        case 3: out = value + ((a + b) >> 1); break;
        case 4: out = value + paeth(a, b, c); break;
        default: throw new Error(`filtro PNG desconocido: ${filter}`);
      }
      rgba[row + x] = out & 0xff;
    }
  }

  return { width, height, rgba };
}

/** { width, height, rgba } → PNG (8 bits RGBA, sin entrelazar). */
function encodePng(rgba, width, height) {
  const bpp = 4;
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  const line = Buffer.alloc(stride);

  let dst = 0;
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const prev = row - stride;

    // Heurística estándar del propio spec: se prueban los cinco filtros y se
    // queda el de menor suma de valores absolutos (el que deja los residuos
    // más pequeños comprime mejor). Sin esto los ficheros salen ~40 % más
    // grandes de lo necesario.
    let bestFilter = 0;
    let bestScore = Infinity;
    for (let filter = 0; filter < 5; filter++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const value = rgba[row + x];
        const a = x >= bpp ? rgba[row + x - bpp] : 0;
        const b = y > 0 ? rgba[prev + x] : 0;
        const c = x >= bpp && y > 0 ? rgba[prev + x - bpp] : 0;
        let residual;
        switch (filter) {
          case 0: residual = value; break;
          case 1: residual = value - a; break;
          case 2: residual = value - b; break;
          case 3: residual = value - ((a + b) >> 1); break;
          default: residual = value - paeth(a, b, c); break;
        }
        residual &= 0xff;
        score += residual < 128 ? residual : 256 - residual;
      }
      if (score < bestScore) {
        bestScore = score;
        bestFilter = filter;
      }
    }

    for (let x = 0; x < stride; x++) {
      const value = rgba[row + x];
      const a = x >= bpp ? rgba[row + x - bpp] : 0;
      const b = y > 0 ? rgba[prev + x] : 0;
      const c = x >= bpp && y > 0 ? rgba[prev + x - bpp] : 0;
      let residual;
      switch (bestFilter) {
        case 0: residual = value; break;
        case 1: residual = value - a; break;
        case 2: residual = value - b; break;
        case 3: residual = value - ((a + b) >> 1); break;
        default: residual = value - paeth(a, b, c); break;
      }
      line[x] = residual & 0xff;
    }

    raw[dst++] = bestFilter;
    line.copy(raw, dst);
    dst += stride;
  }

  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed), 0);
    return Buffer.concat([length, typed, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compresión deflate
  ihdr[11] = 0; // filtrado estándar
  ihdr[12] = 0; // sin entrelazar

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

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
