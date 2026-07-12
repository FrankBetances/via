#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Pipeline de assets de la Audiometría Verbal (herramienta de desarrollo).
 *
 *   node scripts/verbal-assets.js manifest   → estado del banco + assets/verbal-manifest.json
 *   node scripts/verbal-assets.js images     → ilustraciones PROVISIONALES (Chromium headless)
 *   node scripts/verbal-assets.js audio      → locuciones PROVISIONALES (espeak-ng + ffmpeg)
 *   node scripts/verbal-assets.js registry   → regenera src/Screens/VerbalAudiometry/verbalAssets.ts
 *
 * El inventario sale SIEMPRE de `collectAssetInventory()` (fuente única:
 * verbalAudiometryLists.ts, compilado al vuelo con el tsc del proyecto), de
 * modo que listas y assets no pueden divergir sin que el manifiesto lo cante
 * (y el test `verbalAssets.test.ts` lo rompa en CI).
 *
 * PROVISIONALES: las locuciones son síntesis espeak-ng (es) normalizadas en
 * sonoridad (ffmpeg loudnorm) y las ilustraciones son pictogramas emoji /
 * tiles de inicial. Sirven para desarrollo y pilotos técnicos; la producción
 * clínica (locutor profesional + ilustrador, ver
 * docs/design/validacion-clinica-verbal.md) los sustituye archivo a archivo
 * sin tocar código (misma clave).
 *
 * Requisitos (solo para generar, no para compilar la app):
 *   images → playwright + Chromium (PW_CHROMIUM, por defecto /opt/pw-browsers/chromium)
 *   audio  → espeak-ng en PATH + ffmpeg (FFMPEG_BIN o en PATH)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio', 'verbal');
const IMG_DIR = path.join(ROOT, 'assets', 'img', 'verbal');
const MANIFEST = path.join(ROOT, 'assets', 'verbal-manifest.json');
const REGISTRY = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry', 'verbalAssets.ts');
const CLIPS = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry', 'verbalAudioClips.ts');

/* ------------------- carga de la lógica pura (TS → CJS) ------------------- */

function loadVerbalModules() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'verbal-cjs-'));
  const tsc = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  const srcDir = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry');
  execFileSync(tsc, [
    path.join(srcDir, 'verbalAudiometryLists.ts'),
    path.join(srcDir, 'verbalAudiometryResult.ts'),
    path.join(srcDir, 'verbalAudiometryGlyphs.ts'),
    '--outDir', out, '--module', 'commonjs', '--target', 'es2019', '--skipLibCheck',
  ]);
  return {
    lists: require(path.join(out, 'verbalAudiometryLists.js')),
    glyphs: require(path.join(out, 'verbalAudiometryGlyphs.js')).VERBAL_GLYPHS,
  };
}

/** [{ key, word }] únicos por clave, para las opciones ilustradas del banco. */
function imageEntries(lists) {
  const byKey = new Map();
  for (const band of lists.VERBAL_BANDS) {
    for (const item of band.items) {
      for (const opt of item.options) {
        if (opt.image && !byKey.has(opt.image)) byKey.set(opt.image, opt.word);
      }
    }
  }
  return [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, word]) => ({ key, word }));
}

/** [{ key, word }] únicos por clave, para las palabras objetivo (audio). */
function audioEntries(lists) {
  const byKey = new Map();
  for (const band of lists.VERBAL_BANDS) {
    for (const item of band.items) {
      if (!byKey.has(item.audio)) byKey.set(item.audio, item.targetWord);
    }
  }
  return [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, word]) => ({ key, word }));
}

/* -------------------------------- manifest -------------------------------- */

function cmdManifest({ lists }) {
  const audio = audioEntries(lists).map(e => ({
    ...e,
    file: `assets/audio/verbal/${e.key}.m4a`,
    exists: fs.existsSync(path.join(AUDIO_DIR, `${e.key}.m4a`)),
  }));
  const images = imageEntries(lists).map(e => ({
    ...e,
    file: `assets/img/verbal/${e.key}.png`,
    exists: fs.existsSync(path.join(IMG_DIR, `${e.key}.png`)),
  }));
  const missingA = audio.filter(e => !e.exists);
  const missingI = images.filter(e => !e.exists);

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provisional: true,
        note:
          'Orden de producción de assets de la audiometría verbal. Locuciones e ilustraciones ' +
          'actuales son PROVISIONALES (espeak-ng / pictogramas); la producción clínica final ' +
          'sustituye cada archivo conservando su clave.',
        audio,
        images,
      },
      null,
      2,
    ) + '\n',
  );

  console.log(`Audio:    ${audio.length - missingA.length}/${audio.length} presentes`);
  console.log(`Imágenes: ${images.length - missingI.length}/${images.length} presentes`);
  if (missingA.length) console.log('Audio ausente:', missingA.map(e => e.key).join(' '));
  if (missingI.length) console.log('Imágenes ausentes:', missingI.map(e => e.key).join(' '));
  console.log(`Manifiesto → ${path.relative(ROOT, MANIFEST)}`);
}

/* --------------------------------- images --------------------------------- */

async function cmdImages({ lists, glyphs }) {
  let chromium;
  for (const mod of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright']) {
    try { chromium = require(mod).chromium; break; } catch { /* siguiente */ }
  }
  if (!chromium) throw new Error('playwright no disponible (npm i -g playwright o instalar en el proyecto)');
  const executablePath = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';

  fs.mkdirSync(IMG_DIR, { recursive: true });
  const entries = imageEntries(lists);
  const browser = await chromium.launch(fs.existsSync(executablePath) ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

  for (const { key, word } of entries) {
    const glyph = glyphs[word];
    // Pictograma emoji (provisional) o tile de inicial (asset pendiente de
    // ilustrador). Mismo lenguaje visual que el placeholder de WordCard.
    const body = glyph
      ? `<div class="wrap"><span class="g">${glyph}</span></div>`
      : `<div class="wrap tile"><span class="l">${word.charAt(0).toUpperCase()}</span><span class="w">${word}</span></div>`;
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      * { margin:0; box-sizing:border-box }
      body { width:512px; height:512px; display:grid; place-items:center; background:transparent;
             font-family:"Noto Color Emoji","Segoe UI",system-ui,sans-serif }
      .wrap { width:512px; height:512px; display:grid; place-items:center }
      .g { font-size:380px; line-height:1 }
      .tile { width:440px; height:440px; border-radius:72px; background:#F5F2EC;
              border:10px dashed #DDD5C7; display:flex; flex-direction:column;
              align-items:center; justify-content:center; gap:12px }
      .l { font-size:190px; font-weight:800; color:#9A9183;
           font-family:"Segoe UI",system-ui,sans-serif }
      .w { font-size:44px; font-weight:700; color:#6B635A;
           font-family:"Segoe UI",system-ui,sans-serif }
    </style>${body}`);
    await page.screenshot({ path: path.join(IMG_DIR, `${key}.png`), omitBackground: true });
    process.stdout.write('.');
  }
  await browser.close();
  console.log(`\n${entries.length} ilustraciones provisionales → ${path.relative(ROOT, IMG_DIR)}`);
}

/* ---------------------------------- audio --------------------------------- */

function resolveFfmpeg() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch { /* no en PATH */ }
  const pw = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
  if (fs.existsSync(pw)) return pw;
  throw new Error('ffmpeg no disponible (FFMPEG_BIN o en PATH)');
}

function cmdAudio({ lists }) {
  const ffmpeg = resolveFfmpeg();
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const entries = audioEntries(lists);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verbal-wav-'));

  for (const { key, word } of entries) {
    const wav = path.join(tmp, `${key}.wav`);
    // Locución PROVISIONAL: espeak-ng es, ritmo pausado de palabra aislada.
    execFileSync('espeak-ng', ['-v', 'es', '-s', '130', '-g', '6', '-w', wav, word]);
    // m4a AAC mono 44.1k con sonoridad normalizada (loudnorm): la escala de
    // nivel del adaptador presupone recortes a un RMS de referencia común.
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', wav,
      '-af', 'loudnorm=I=-20:TP=-3:LRA=7,silenceremove=start_periods=1:start_threshold=-45dB',
      '-ar', '44100', '-ac', '1', '-c:a', 'aac', '-b:a', '96k',
      path.join(AUDIO_DIR, `${key}.m4a`),
    ]);
    process.stdout.write('.');
  }
  console.log(`\n${entries.length} locuciones provisionales → ${path.relative(ROOT, AUDIO_DIR)}`);
}

/* -------------------------------- registry -------------------------------- */

function cmdRegistry({ lists }) {
  const audio = audioEntries(lists);
  const images = imageEntries(lists);
  const missing = [
    ...audio.filter(e => !fs.existsSync(path.join(AUDIO_DIR, `${e.key}.m4a`))).map(e => `audio/${e.key}`),
    ...images.filter(e => !fs.existsSync(path.join(IMG_DIR, `${e.key}.png`))).map(e => `img/${e.key}`),
  ];
  if (missing.length) {
    throw new Error(`Assets ausentes (genere primero audio/images): ${missing.join(' ')}`);
  }

  const audioLines = audio
    .map(e => `  ${e.key}: require('../../../assets/audio/verbal/${e.key}.m4a'),`)
    .join('\n');
  const imageLines = images
    .map(e => `  ${e.key}: require('../../../assets/img/verbal/${e.key}.png'),`)
    .join('\n');

  const content = `import { Image, ImageSourcePropType } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  Registro de assets de la Audiometría Verbal.                               */
/*                                                                             */
/*  GENERADO por \`node scripts/verbal-assets.js registry\` a partir del banco   */
/*  de estímulos (collectAssetInventory) — NO editar a mano: regenere tras     */
/*  cambiar las listas. Los require() literales son obligatorios para que      */
/*  Metro empaquete los archivos (mismo motivo que en articulationAudio.ts).   */
/*                                                                             */
/*  Los assets actuales son PROVISIONALES (locución espeak-ng + pictogramas);  */
/*  la producción clínica final sustituye cada archivo conservando su clave.   */
/* -------------------------------------------------------------------------- */

const AUDIO: Record<string, number> = {
${audioLines}
};

const IMAGES: Record<string, ImageSourcePropType> = {
${imageLines}
};

/** Ruta reproducible del recorte de una palabra objetivo (\`decodeAudioDataSource\`). */
export const verbalAudioSource = (audioKey: string): string | null => {
  const mod = AUDIO[audioKey];
  if (mod == null) return null;
  try {
    return Image.resolveAssetSource(mod)?.uri ?? null;
  } catch {
    return null;
  }
};

/** Ilustración de una opción de tarjeta (bandas con imagen). */
export const verbalImageSource = (imageKey: string): ImageSourcePropType | undefined =>
  IMAGES[imageKey];

/** Claves registradas (para tests de completitud contra el inventario). */
export const registeredVerbalAssets = () => ({
  audio: Object.keys(AUDIO).sort(),
  images: Object.keys(IMAGES).sort(),
});
`;
  fs.writeFileSync(REGISTRY, content);
  console.log(`Registro → ${path.relative(ROOT, REGISTRY)} (${audio.length} audios, ${images.length} imágenes)`);

  // Módulo de recortes INCRUSTADOS en base64 (vía primaria de reproducción, ver
  // verbalAudioClips.ts). Incrustar evita depender de la ruta del asset, que en
  // desarrollo es una URL de Metro que la decodificación nativa por ruta no abre.
  const clipLines = audio
    .map(e => `  ${e.key}: '${fs.readFileSync(path.join(AUDIO_DIR, `${e.key}.m4a`)).toString('base64')}',`)
    .join('\n');
  const clips = `/* eslint-disable */
/* -------------------------------------------------------------------------- */
/*  Recortes de audio de la Audiometría Verbal INCRUSTADOS en base64 (m4a).    */
/*                                                                             */
/*  GENERADO por \`node scripts/verbal-assets.js registry\` — NO editar a mano.  */
/*                                                                             */
/*  ¿Por qué incrustar y no depender de la ruta del asset? Con el motor de     */
/*  \`react-native-audio-api\`, la vía por ruta (\`decodeAudioDataSource\`) solo    */
/*  acepta ficheros LOCALES: en desarrollo (Metro dev server) el asset se      */
/*  sirve como URL \`http://…?platform=…\` y la decodificación por ruta falla,   */
/*  y el respaldo \`fetch().arrayBuffer()\` de RN es poco fiable con binarios —   */
/*  por eso la audiometría verbal no sonaba en Android Studio. Decodificar     */
/*  estos bytes EN MEMORIA (\`decodeAudioData\`) funciona idéntico en desarrollo */
/*  y en release, sin red ni sistema de ficheros.                              */
/* -------------------------------------------------------------------------- */

export const VERBAL_AUDIO_BASE64: Record<string, string> = {
${clipLines}
};
`;
  fs.writeFileSync(CLIPS, clips);
  console.log(`Recortes base64 → ${path.relative(ROOT, CLIPS)} (${audio.length} clips)`);
}

/* ----------------------------------- main ---------------------------------- */

async function main() {
  const cmd = process.argv[2] || 'manifest';
  const mods = loadVerbalModules();
  if (cmd === 'manifest') return cmdManifest(mods);
  if (cmd === 'images') return cmdImages(mods);
  if (cmd === 'audio') return cmdAudio(mods);
  if (cmd === 'registry') return cmdRegistry(mods);
  throw new Error(`Comando desconocido: ${cmd} (manifest|images|audio|registry)`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
