/* -------------------------------------------------------------------------- */
/*  Generador del Manual de Usuario de VIA+ en PDF.                            */
/*                                                                            */
/*  Lee `manual.html` (maquetación con marcadores __LOGO__, __WAVE__, etc.),   */
/*  inyecta los SVG/HTML generados (isotipo, ondas, firma, tarjetas de módulo) */
/*  y renderiza el resultado a A4 con Chromium vía Playwright.                 */
/*                                                                            */
/*  Uso:  node docs/manual/build-pdf.js                                        */
/*                                                                            */
/*  Variables de entorno opcionales:                                          */
/*    PLAYWRIGHT_MODULE   ruta al paquete playwright (por defecto 'playwright')*/
/*    CHROMIUM_PATH       ejecutable de Chromium (si no, usa el de Playwright) */
/* -------------------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');

const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
let chromium;
try {
  ({ chromium } = require(playwrightModule));
} catch (e) {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const SRC = path.join(__dirname, 'manual.html');
const OUT = path.join(__dirname, 'VIA+_Manual_de_Usuario.pdf');

/* ---------- Isotipo VIA+ (réplica de src/Components/Common/ViaIcon.tsx) ---------- */
const BARS = [26, 46, 74, 100, 74, 46, 26];
let gid = 0;
function logo(size) {
  const u = `lg${++gid}`;
  const START_X = 16.5, BAR_W = 9, GAP = 9, CY = 75;
  const bars = BARS.map((h, i) =>
    `<rect x="${START_X + i * (BAR_W + GAP)}" y="${CY - h / 2}" width="${BAR_W}" height="${h}" rx="4.5" fill="#fff" fill-opacity="0.96"/>`
  ).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FDB35C"/><stop offset="0.46" stop-color="#FF8A1E"/><stop offset="1" stop-color="#E85F12"/>
      </linearGradient>
      <linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="150" height="150" rx="42" fill="url(#${u}b)"/>
    <rect x="0" y="0" width="150" height="81" rx="42" fill="url(#${u}g)"/>
    ${bars}
    <rect x="105" y="32.5" width="22" height="7" rx="3.5" fill="#fff" fill-opacity="0.96"/>
    <rect x="112.5" y="25" width="7" height="22" rx="3.5" fill="#fff" fill-opacity="0.96"/>
  </svg>`;
}

/* ---------- Campo de onda: ruido gris (izq) → onda naranja ordenada (der) ---------- */
function wave() {
  const W = 210, H = 96, midY = H / 2;
  let seed = 20260704;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let dots = '';
  for (let i = 0; i < 26; i++) {
    const x = 4 + rnd() * 78;
    const y = 10 + rnd() * (H - 20);
    const r = 1.6 + rnd() * 1.8;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#B3A791" opacity="${(0.4 + rnd() * 0.4).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const x = 120 + t * 86;
    const y = midY + Math.sin(t * Math.PI * 2 * 2.2) * 22;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="#FF7F00" opacity="0.9"/>`;
  }
  let p = '';
  for (let i = 0; i <= 60; i++) {
    const t = i / 60; const x = 120 + t * 86; const y = midY + Math.sin(t * Math.PI * 2 * 2.2) * 22;
    p += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <path d="${p}" fill="none" stroke="#FF7F00" stroke-opacity="0.28" stroke-width="1.4"/>
    <line x1="90" y1="14" x2="90" y2="82" stroke="#D9CFBE" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="6" y="90" font-family="monospace" font-size="7" fill="#A89F93" font-weight="700">RUIDO</text>
    <text x="150" y="90" font-family="monospace" font-size="7" fill="#D98324" font-weight="700">INFORMACIÓN</text>
    ${dots}
  </svg>`;
}

/* ---------- Firma manuscrita ---------- */
function sign() {
  return `<svg width="150" height="52" viewBox="0 0 150 52" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 40 C14 8 22 6 26 30 C28 42 32 44 38 26 C42 14 48 12 50 34 C52 46 58 22 66 20 C74 18 70 40 80 38 C92 36 86 14 98 16 C110 18 104 40 116 34 C128 28 122 18 134 22 C140 24 144 30 148 26"
      fill="none" stroke="#3A352F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ---------- Forma de onda de voz (barras) ---------- */
function voicewave(color, n, base) {
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let bars = '';
  for (let i = 0; i < n; i++) {
    const h = 4 + Math.abs(Math.sin(i * 0.7)) * base + rnd() * 6;
    bars += `<span style="display:inline-block;width:2px;height:${h.toFixed(0)}px;background:${color};border-radius:2px;opacity:${(0.5 + rnd() * 0.5).toFixed(2)}"></span>`;
  }
  return bars;
}

/* ---------- Tarjeta de módulo (hub) ---------- */
function modcard(color, soft, emoji, tag, title, desc, dur, age, order) {
  const sel = order !== 'x';
  const border = sel ? color : '#F0ECE4';
  const chk = sel
    ? `<div class="mc-chk" style="background:${color};">${order}</div>`
    : `<div class="mc-chk" style="background:#fff;border:1.5px solid #E0D8C9;"></div>`;
  return `<div class="modcard${sel ? ' sel' : ''}" style="border-color:${border};">
    <div class="mc-top" style="background:${soft};">
      <div class="mc-emoji">${emoji}</div>
      <div class="mc-tag" style="color:${color};">${tag}</div>
      ${chk}
    </div>
    <div class="mc-body">
      <div class="mc-h">${title}</div>
      <div class="mc-d">${desc}</div>
      <div class="mc-meta">
        <span class="mm" style="background:${soft};color:${color};">⏱ ${dur}</span>
        <span class="mm" style="background:#fff;border:1px solid #EDE7DB;color:#9A9183;">👶 ${age}</span>
      </div>
    </div>
    <div class="mc-bar" style="background:${sel ? color : soft};"></div>
  </div>`;
}

/* ---------- Chip de módulo (vistazo) ---------- */
function chip(emoji, color, soft, title, note) {
  return `<div style="display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #EAE3D7; border-left:3px solid ${color}; border-radius:10px; padding:8px 9px;">
    <div style="width:26px;height:26px;border-radius:8px;background:${soft};display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto;">${emoji}</div>
    <div><div style="font-weight:800; font-size:9.5px; color:#2B2620; line-height:1.1;">${title}</div><div style="font-size:8px; color:#9A9183; margin-top:1px;">${note}</div></div>
  </div>`;
}

/* ---------- Reemplazos ---------- */
let html = fs.readFileSync(SRC, 'utf8');
const repl = {
  '__LOGO_120__': logo(120),
  '__LOGO_78__': logo(78),
  '__LOGO_54__': logo(54),
  '__LOGO_22__': logo(22),
  '__WAVE__': wave(),
  '__SIGN__': sign(),
  '__VOICEWAVE__': voicewave('#7C3AED', 26, 20),
  '__VOICEWAVE_ART__': voicewave('#EA580C', 20, 16),
  '__VOICEWAVE_PROS__': voicewave('#C026D3', 30, 14),
  '__MODCARD_audio_🎧_AUDICIÓN_Audiometría Infantil_1__':
    modcard('#0284C7', '#E0F2FE', '🎧', 'AUDICIÓN', 'Audiometría Infantil', 'Audiometría tonal por juego.', '6–8 min', '6 m–5 a', '1'),
  '__MODCARD_voice_🎤_VOZ_Análisis de Voz_2__':
    modcard('#7C3AED', '#F3E8FF', '🎤', 'VOZ', 'Análisis de Voz', 'Vocal /a/ · F0, jitter, HNR.', '3–5 min', 'Todas', '2'),
  '__MODCARD_art_🗣️_LENGUAJE_Articulación · T.A.R._x__':
    modcard('#EA580C', '#FFEDD5', '🗣️', 'LENGUAJE', 'Articulación · T.A.R.', 'Repetición · registro SODA.', '8–12 min', '3–7 a', 'x'),
  '__MODCARD_mchat_🧩_CONDUCTA_Cuestionario Autismo_x__':
    modcard('#DB2777', '#FCE7F3', '🧩', 'CONDUCTA', 'Cuestionario Autismo', 'Cribado M-CHAT-R de TEA.', '5–10 min', '16–30 m', 'x'),
  '__MODCARD_verbal_🔊_AUDICIÓN_Audiometría Verbal_x__':
    modcard('#2563EB', '#DBEAFE', '🔊', 'AUDICIÓN', 'Audiometría Verbal', 'Palabras por tarjetas · campo libre.', '5–8 min', '2 a–adulto', 'x'),
  '__MODCARD_ef_🧠_COGNICIÓN_Funciones Ejecutivas_x__':
    modcard('#059669', '#D1FAE5', '🧠', 'COGNICIÓN', 'Funciones Ejecutivas', '5 mini-juegos de tarjetas.', '8–12 min', '3–12 a', 'x'),
  '__CHIP_📋_#EA580C_#FFEDD5_Evaluación Clínica (CAP)_Anamnesis + firma__': chip('📋', '#EA580C', '#FFEDD5', 'Evaluación Clínica (CAP)', 'Anamnesis + firma'),
  '__CHIP_🧩_#DB2777_#FCE7F3_Autismo M-CHAT-R_Cribado de TEA__': chip('🧩', '#DB2777', '#FCE7F3', 'Autismo M-CHAT-R', 'Cribado de TEA'),
  '__CHIP_🎙️_#0D9488_#CCFBF1_Sonómetro Ambiental_Gate de sala__': chip('🎙️', '#0D9488', '#CCFBF1', 'Sonómetro Ambiental', 'Gate de sala'),
  '__CHIP_🎧_#0284C7_#E0F2FE_Audiometría Infantil_Tonal por juego__': chip('🎧', '#0284C7', '#E0F2FE', 'Audiometría Infantil', 'Tonal por juego'),
  '__CHIP_🚂_#0D9488_#CCFBF1_Audiometría Condicionada_El Tren del Sonido__': chip('🚂', '#0D9488', '#CCFBF1', 'Audiometría Condicionada', 'El Tren del Sonido'),
  '__CHIP_🎤_#7C3AED_#F3E8FF_Análisis de Voz_F0 · jitter · HNR__': chip('🎤', '#7C3AED', '#F3E8FF', 'Análisis de Voz', 'F0 · jitter · HNR'),
  '__CHIP_💧_#DC2626_#FEE2E2_Disfagia MECV-V_Pulsioximetría BLE__': chip('💧', '#DC2626', '#FEE2E2', 'Disfagia MECV-V', 'Pulsioximetría BLE'),
  '__CHIP_😴_#4F46E5_#E0E7FF_Cribado SAHS_PSQ de Chervin__': chip('😴', '#4F46E5', '#E0E7FF', 'Cribado SAHS', 'PSQ de Chervin'),
  '__CHIP_🗣️_#EA580C_#FFEDD5_Articulación T.A.R._Registro SODA__': chip('🗣️', '#EA580C', '#FFEDD5', 'Articulación T.A.R.', 'Registro SODA'),
  '__CHIP_🔊_#2563EB_#DBEAFE_Audiometría Verbal_Palabras por tarjetas__': chip('🔊', '#2563EB', '#DBEAFE', 'Audiometría Verbal', 'Palabras por tarjetas'),
  '__CHIP_🧠_#059669_#D1FAE5_Funciones Ejecutivas_5 mini-juegos__': chip('🧠', '#059669', '#D1FAE5', 'Funciones Ejecutivas', '5 mini-juegos'),
  '__CHIP_〰️_#C026D3_#FAE8FF_Análisis Prosódico_Ritmo · pausas · tono__': chip('〰️', '#C026D3', '#FAE8FF', 'Análisis Prosódico', 'Ritmo · pausas · tono'),
  '__CHIP_🧩_#0D9488_#CCFBF1_Hitos del Lenguaje ASHA_Percentil 75 · 0-5 a__': chip('🧩', '#0D9488', '#CCFBF1', 'Hitos del Lenguaje ASHA', 'Percentil 75 · 0-5 a'),
};
for (const [k, v] of Object.entries(repl)) {
  html = html.split(k).join(v);
}

/* -------------------------------------------------------------------------- */
/*  Guarda: ningún marcador puede sobrevivir al reemplazo.                     */
/*                                                                            */
/*  Nació de un fallo real: se añadió el chip de prosodia a `manual.html` sin  */
/*  darlo de alta aquí, y el PDF salió con el literal `__CHIP_…__` impreso en  */
/*  la página 3. El reemplazo es un split/join mudo —no avisa de lo que no     */
/*  encuentra—, así que la única forma de que no vuelva a pasar es reventar    */
/*  la compilación en vez de publicar basura.                                  */
/* -------------------------------------------------------------------------- */
/* Los marcadores llevan espacios dentro («Análisis Prosódico»), así que el
   patrón NO puede excluir el espacio: se delimita por `<`/`>` y se cierra de
   forma perezosa en el primer `__`. */
const leftovers = [...new Set(html.match(/__[A-Z][^<>]*?__/g) || [])];
if (leftovers.length) {
  console.error('\n✖ Marcadores sin sustituir en manual.html:\n');
  for (const m of leftovers) console.error('   ' + m);
  console.error('\nDalos de alta en el mapa `repl` de este fichero.\n');
  process.exit(1);
}

const built = path.join(__dirname, '_built.html');
fs.writeFileSync(built, html);

(async () => {
  const launchOpts = { args: ['--no-sandbox', '--font-render-hinting=none'] };
  if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  const emitDir = process.env.EMIT_PAGES;
  const scale = emitDir ? 3 : 1;
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: scale });
  await page.goto('file://' + built, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: OUT,
    width: '210mm',
    height: '297mm',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  // Modo opcional: exporta cada página como PNG (para armar el .docx).
  if (emitDir) {
    fs.mkdirSync(emitDir, { recursive: true });
    const pages = await page.$$('.page');
    for (let i = 0; i < pages.length; i++) {
      await pages[i].screenshot({ path: path.join(emitDir, `p${String(i + 1).padStart(2, '0')}.png`) });
    }
    console.log('Páginas PNG:', pages.length, '→', emitDir);
  }

  await browser.close();
  fs.unlinkSync(built);
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log('PDF generado:', OUT, kb + ' KB');
})();
