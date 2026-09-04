#!/usr/bin/env node
/* eslint-disable no-bitwise -- PNG se define a nivel de bit: CRC-32, filtros
 * por línea y truncado a octeto. Mismo motivo por el que ya lo llevaba
 * `scripts/resize-verbal-images.js`, de donde sale este códec. */
/* -------------------------------------------------------------------------- */
/*  Códec PNG mínimo (8 bits · RGBA · sin entrelazar), en Node puro.           */
/*                                                                            */
/*  Estaba dentro de `scripts/resize-verbal-images.js` y ahora lo usan DOS     */
/*  herramientas: aquella y `scripts/build-launcher-icons.js`. Se saca a un    */
/*  módulo en vez de copiarlo porque un códec duplicado se arregla en un sitio */
/*  y se queda roto en el otro.                                               */
/*                                                                            */
/*  No se mete una dependencia (`pngjs` está en `node_modules`, pero como      */
/*  transitiva de `qrcode`: nadie la declara y puede desaparecer en cualquier  */
/*  instalación). El repositorio ya escribía PNG a mano en                     */
/*  `docs/play-store/build-feature-graphic.js` por el mismo motivo.            */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const zlib = require('zlib');

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

module.exports = { PNG_SIGNATURE, crc32, paeth, readHeader, decodePng, encodePng };
