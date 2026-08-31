#!/usr/bin/env node
/* eslint-disable no-bitwise -- PNG se define a nivel de bit: CRC-32, filtros
 * por línea y truncado a octeto. Mismo motivo que en
 * `scripts/resize-verbal-images.js`. */
/* -------------------------------------------------------------------------- */
/*  Gráfico destacado (feature graphic) de la ficha de Google Play.            */
/*                                                                            */
/*  Uso:  node docs/play-store/build-feature-graphic.js                        */
/*                                                                            */
/*  Play exige PNG o JPEG de 1024 × 500 px SIN transparencia. Chromium         */
/*  siempre escribe el PNG en RGBA, así que el último paso reescribe el        */
/*  fichero como PNG de 24 bits (color type 2): un alfa opaco de sobra se      */
/*  cuela en la consola sin avisar y no queremos descubrirlo al subirlo.       */
/*                                                                            */
/*  La identidad es la real de la app, no una aproximación: isotipo replicado  */
/*  de src/Components/Common/ViaIcon.tsx y paleta de src/Theme/                */
/*  gluestack-ui.config.ts, igual que hace docs/manual/build-pdf.js.           */
/*                                                                            */
/*  Variables de entorno opcionales:                                          */
/*    PLAYWRIGHT_MODULE   ruta al paquete playwright (por defecto 'playwright')*/
/*    CHROMIUM_PATH       ejecutable de Chromium (si no, usa el de Playwright) */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
let chromium;
try {
  ({ chromium } = require(playwrightModule));
} catch (e) {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const WIDTH = 1024;
const HEIGHT = 500;
const OUT = path.join(__dirname, 'via-plus-feature-graphic-1024x500.png');

/* ---------- Paleta (src/Theme/gluestack-ui.config.ts + manual) ---------- */
const CREAM_HI = '#F6F2EA';
const CREAM_LO = '#EDE4D6';
const INK = '#2B2620';
const INK_SOFT = '#6B635A';
const ORANGE = '#FF7F00';

/* ---------- Isotipo VIA+ (réplica de src/Components/Common/ViaIcon.tsx) ---------- */
const BARS = [26, 46, 74, 100, 74, 46, 26];

function logo(size) {
  const START_X = 16.5;
  const BAR_W = 9;
  const GAP = 9;
  const CY = 75;
  const bars = BARS.map(
    (h, i) =>
      `<rect x="${START_X + i * (BAR_W + GAP)}" y="${CY - h / 2}" width="${BAR_W}" height="${h}" rx="4.5" fill="#fff" fill-opacity="0.96"/>`,
  ).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="isoBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FDB35C"/><stop offset="0.46" stop-color="#FF8A1E"/><stop offset="1" stop-color="#E85F12"/>
      </linearGradient>
      <linearGradient id="isoGloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="150" height="150" rx="42" fill="url(#isoBg)"/>
    <rect x="0" y="0" width="150" height="81" rx="42" fill="url(#isoGloss)"/>
    ${bars}
    <rect x="105" y="32.5" width="22" height="7" rx="3.5" fill="#fff" fill-opacity="0.96"/>
    <rect x="112.5" y="25" width="7" height="22" rx="3.5" fill="#fff" fill-opacity="0.96"/>
  </svg>`;
}

/* ---------- Motivo de onda: el isotipo de 7 barras extendido a un campo ----------
   La envolvente es simétrica y determinista (nada de aleatorio: el gráfico
   tiene que salir idéntico en cada regeneración). Es decorativo y sangra por
   el borde derecho, fuera de la zona segura de la ficha. */
function waveField() {
  const COUNT = 19;
  const W = 376;
  const H = 312;
  const BAR_W = 11;
  const gap = (W - COUNT * BAR_W) / (COUNT - 1);
  let bars = '';
  for (let i = 0; i < COUNT; i++) {
    const t = (i / (COUNT - 1)) * 2 - 1; // −1 … 1
    const envelope = Math.cos((t * Math.PI) / 2) ** 1.4; // campana suave
    // Dos armónicos en vez de uno: la silueta ondula como una voz en lugar de
    // alternar barra alta / barra baja, que a tamaño pequeño se lee como ruido.
    const ripple = 0.78 + 0.16 * Math.cos(i * 0.86) + 0.06 * Math.cos(i * 1.9);
    const h = Math.max(18, H * envelope * ripple);
    const x = i * (BAR_W + gap);
    const y = (H - h) / 2;
    const opacity = (0.34 + 0.66 * envelope).toFixed(3);
    bars += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${BAR_W}" height="${h.toFixed(2)}" rx="5" fill="url(#waveGrad)" fill-opacity="${opacity}"/>`;
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FDB35C"/><stop offset="0.5" stop-color="#FF8A1E"/><stop offset="1" stop-color="#E85F12"/>
      </linearGradient>
    </defs>
    ${bars}
  </svg>`;
}

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    background: linear-gradient(118deg, ${CREAM_HI} 0%, ${CREAM_HI} 38%, ${CREAM_LO} 100%);
    font-family: 'Rethink Sans', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', 'Liberation Sans', Arial, sans-serif;
    color: ${INK};
    position: relative;
    -webkit-font-smoothing: antialiased;
  }
  /* Halo cálido bajo el motivo de onda. */
  .glow {
    position: absolute; right: -120px; top: 50%; transform: translateY(-50%);
    width: 660px; height: 660px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,138,30,0.16) 0%, rgba(255,138,30,0.06) 45%, rgba(255,138,30,0) 70%);
  }
  .wave { position: absolute; right: 52px; top: 50%; transform: translateY(-50%); }

  /* Zona segura: todo el contenido legible dentro de 88 px de margen, por si la
     ficha recorta los bordes en alguna disposición. */
  .content { position: absolute; left: 88px; top: 50%; transform: translateY(-50%); width: 560px; }

  .brand { display: flex; align-items: center; gap: 22px; }
  .brand svg { display: block; border-radius: 26px; box-shadow: 0 10px 26px rgba(184,106,38,0.24); }
  .wordmark { font-size: 78px; font-weight: 800; letter-spacing: -2.5px; line-height: 1; }

  .tagline { margin-top: 26px; font-size: 27px; font-weight: 500; line-height: 1.28; color: ${INK_SOFT}; }
  .rule { margin-top: 22px; width: 56px; height: 4px; border-radius: 2px; background: ${ORANGE}; }

  .chips { margin-top: 24px; display: flex; gap: 10px; }
  .chip {
    font-size: 16px; font-weight: 600; color: ${INK_SOFT};
    background: rgba(255,255,255,0.72); border: 1px solid #E3D8C6;
    border-radius: 999px; padding: 8px 16px; white-space: nowrap;
  }
</style></head><body>
  <div class="glow"></div>
  <div class="wave">${waveField()}</div>
  <div class="content">
    <div class="brand">${logo(104)}<div class="wordmark">VIA+</div></div>
    <div class="tagline">Valoración Interactiva<br>de Audición y Lenguaje</div>
    <div class="rule"></div>
    <div class="chips">
      <span class="chip">Audiometrías</span>
      <span class="chip">Voz y articulación</span>
      <span class="chip">Cribados</span>
    </div>
  </div>
</body></html>`;

/* -------------------------------------------------------------------------- */
/*  RGBA → RGB: reescribe el PNG como color type 2 (24 bits, sin canal alfa).  */
/*  Sin dependencias: inflar IDAT, deshacer los filtros por línea, tirar el    */
/*  alfa y volver a escribir con filtro 0. Falla ruidosamente si el PNG no es  */
/*  el que escribe Chromium (8 bits, RGBA, no entrelazado).                    */
/* -------------------------------------------------------------------------- */
function stripAlpha(buf) {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('no es un PNG');

  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += 12 + len;
  }

  const ihdr = chunks.find(c => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  // Chromium ya escribe color type 2 cuando la página es opaca de punta a
  // punta; entonces no hay nada que quitar. La conversión de abajo es la red
  // por si un cambio de maquetación introduce un píxel translúcido y el
  // screenshot pasa a RGBA sin que nadie lo note.
  if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`PNG inesperado: depth=${depth} colorType=${colorType} interlace=${interlace}`);
  }
  if (colorType === 2) return buf;

  const raw = zlib.inflateSync(
    Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)),
  );

  const srcBpp = 4;
  const srcStride = width * srcBpp;
  const dstBpp = 3;
  const dstStride = width * dstBpp;
  const prev = Buffer.alloc(srcStride);
  const cur = Buffer.alloc(srcStride);
  const out = Buffer.alloc(height * (1 + dstStride));
  let opaque = true;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + srcStride);
    const filter = raw[rowStart];
    raw.copy(cur, 0, rowStart + 1, rowStart + 1 + srcStride);

    for (let x = 0; x < srcStride; x++) {
      const a = x >= srcBpp ? cur[x - srcBpp] : 0; // izquierda
      const b = prev[x]; // arriba
      const c = x >= srcBpp ? prev[x - srcBpp] : 0; // diagonal
      let add = 0;
      switch (filter) {
        case 0: add = 0; break;
        case 1: add = a; break;
        case 2: add = b; break;
        case 3: add = (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`filtro PNG desconocido: ${filter}`);
      }
      cur[x] = (cur[x] + add) & 0xff;
    }

    const dstStart = y * (1 + dstStride);
    out[dstStart] = 0; // filtro None: el deflate posterior ya comprime de sobra
    for (let x = 0; x < width; x++) {
      if (cur[x * 4 + 3] !== 0xff) opaque = false;
      out[dstStart + 1 + x * 3] = cur[x * 4];
      out[dstStart + 2 + x * 3] = cur[x * 4 + 1];
      out[dstStart + 3 + x * 3] = cur[x * 4 + 2];
    }
    cur.copy(prev);
  }

  if (!opaque) {
    throw new Error('el render tiene píxeles translúcidos; Play rechaza el gráfico destacado con transparencia');
  }

  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(crcBuf) >>> 0, 0);
    return Buffer.concat([head, data, tail]);
  };

  const newIhdr = Buffer.alloc(13);
  newIhdr.writeUInt32BE(width, 0);
  newIhdr.writeUInt32BE(height, 4);
  newIhdr[8] = 8;
  newIhdr[9] = 2; // truecolor sin alfa
  newIhdr[10] = 0;
  newIhdr[11] = 0;
  newIhdr[12] = 0;

  return Buffer.concat([
    SIG,
    chunk('IHDR', newIhdr),
    chunk('IDAT', zlib.deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

(async () => {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'load' });
  const shot = await page.screenshot({ type: 'png', omitBackground: false });
  await browser.close();

  fs.writeFileSync(OUT, stripAlpha(shot));
  console.log(`${path.relative(process.cwd(), OUT)} — ${WIDTH}×${HEIGHT}, PNG 24 bits, ${(fs.statSync(OUT).size / 1024).toFixed(0)} kB`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
