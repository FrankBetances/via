#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Pipeline de assets de la Audiometría Verbal (herramienta de desarrollo).
 *
 *   node scripts/verbal-assets.js manifest [--lang es|gl|es-DO]  → estado del banco + manifiesto
 *   node scripts/verbal-assets.js images   [--lang …]         → ilustraciones PROVISIONALES (Chromium headless)
 *   node scripts/verbal-assets.js audio    [--lang …]         → locuciones PROVISIONALES (espeak-ng o motor neural)
 *   node scripts/verbal-assets.js registry                    → regenera src/Screens/VerbalAudiometry/verbalAssets.ts
 *
 * El inventario sale SIEMPRE de `collectLangAssetInventory(lang)` (fuente
 * única: verbalAudiometryBanks.ts, compilado al vuelo con el tsc del
 * proyecto), de modo que listas y assets no pueden divergir sin que el
 * manifiesto lo cante (y el test `verbalAssets.test.ts` lo rompa en CI).
 *
 * IDIOMAS (infra M1/Q1): `es` conserva su disposición histórica
 * (assets/{audio,img}/verbal + verbal-manifest.json); las variantes usan
 * assets/{audio,img}/verbal/<lang>/ y verbal-manifest.<lang>.json. Una
 * variante HEREDA las ilustraciones de su base (sin duplicar archivos, el
 * manifiesto las marca `inherited`), pero el AUDIO es siempre propio: cada
 * idioma se locuta con su voz (Q4.1).
 *
 * VOZ: `es` usa espeak-ng por defecto (histórico) o el motor de voz neural
 * (tools/nos/tts.py, Piper/Celtia) con VERBAL_TTS=neural; las demás lenguas
 * usan siempre el motor neural. El post-proceso ffmpeg (loudnorm, m4a) es
 * idéntico para todas las voces: mismo objetivo LUFS entre idiomas.
 *
 * PROVISIONALES: locuciones sintéticas e ilustraciones pictograma/tile.
 * Sirven para desarrollo y pilotos técnicos; la producción clínica (locutor
 * profesional + ilustrador, ver docs/design/validacion-clinica-verbal.md)
 * los sustituye archivo a archivo sin tocar código (misma clave).
 *
 * Requisitos (solo para generar, no para compilar la app):
 *   images → playwright + Chromium (PW_CHROMIUM, por defecto /opt/pw-browsers/chromium)
 *   audio  → ffmpeg (FFMPEG_BIN o en PATH) + espeak-ng (es) o
 *            tools/nos (venv + modelos, ver tools/nos/README.md) para voz neural
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUDIO_ROOT = path.join(ROOT, 'assets', 'audio', 'verbal');
const IMG_ROOT = path.join(ROOT, 'assets', 'img', 'verbal');
const REGISTRY = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry', 'verbalAssets.ts');
const CLIPS = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry', 'verbalAudioClips.ts');
const NOS_TTS = path.join(ROOT, 'tools', 'nos', 'tts.py');

/** Rutas por idioma: `es` conserva la disposición histórica (sin subcarpeta). */
function langPaths(lang) {
  const sub = lang === 'es' ? [] : [lang];
  return {
    audioDir: path.join(AUDIO_ROOT, ...sub),
    imgDir: path.join(IMG_ROOT, ...sub),
    manifest: path.join(ROOT, 'assets', lang === 'es' ? 'verbal-manifest.json' : `verbal-manifest.${lang}.json`),
  };
}

/* ------------------- carga de la lógica pura (TS → CJS) ------------------- */

function loadVerbalModules(lang) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'verbal-cjs-'));
  const tsc = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  const srcDir = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry');
  execFileSync(tsc, [
    path.join(srcDir, 'verbalAudiometryBanks.ts'),
    path.join(srcDir, 'verbalAudiometryAudit.es-DO.ts'),
    path.join(srcDir, 'verbalAudiometryResult.ts'),
    path.join(srcDir, 'verbalAudiometryGlyphs.ts'),
    '--outDir', out, '--module', 'commonjs', '--target', 'es2019', '--skipLibCheck',
  ]);
  const banks = require(path.join(out, 'verbalAudiometryBanks.js'));
  return {
    bands: banks.getVerbalBands(lang),
    inventory: banks.collectLangAssetInventory(lang),
    glyphs: require(path.join(out, 'verbalAudiometryGlyphs.js')).VERBAL_GLYPHS,
    audit: require(path.join(out, 'verbalAudiometryAudit.es-DO.js')),
  };
}

/** [{ key, word }] únicos por clave, para las opciones ilustradas del banco. */
function imageEntries(bands) {
  const byKey = new Map();
  for (const band of bands) {
    for (const item of band.items) {
      for (const opt of item.options) {
        if (opt.image && !byKey.has(opt.image)) byKey.set(opt.image, opt.word);
      }
    }
  }
  return [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, word]) => ({ key, word }));
}

/** [{ key, word }] únicos por clave, para las palabras objetivo (audio). */
function audioEntries(bands) {
  const byKey = new Map();
  for (const band of bands) {
    for (const item of band.items) {
      if (!byKey.has(item.audio)) byKey.set(item.audio, item.targetWord);
    }
  }
  return [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, word]) => ({ key, word }));
}

/* -------------------------------- manifest -------------------------------- */

function cmdManifest({ bands, inventory }, lang) {
  const { audioDir, imgDir, manifest } = langPaths(lang);
  const inherited = new Set(inventory.inheritedImages);
  const basePaths = langPaths('es');

  const audio = audioEntries(bands).map(e => ({
    ...e,
    file: path.relative(ROOT, path.join(audioDir, `${e.key}.m4a`)),
    exists: fs.existsSync(path.join(audioDir, `${e.key}.m4a`)),
  }));
  const images = imageEntries(bands).map(e => {
    // Herencia (Q1.4): la ilustración de la variante puede sustituirse
    // archivo a archivo; si no existe la propia, vale la del idioma base.
    const own = path.join(imgDir, `${e.key}.png`);
    const useInherited = lang !== 'es' && inherited.has(e.key) && !fs.existsSync(own);
    const file = useInherited ? path.join(basePaths.imgDir, `${e.key}.png`) : own;
    return {
      ...e,
      file: path.relative(ROOT, file),
      ...(lang !== 'es' ? { inherited: useInherited } : {}),
      exists: fs.existsSync(file),
    };
  });
  const missingA = audio.filter(e => !e.exists);
  const missingI = images.filter(e => !e.exists);

  // Aprobación clínica del AUDIO de una variante (Q4.4/Q6.3): si existe
  // assets/verbal-approval.<lang>.json se incrusta en el manifiesto y el
  // paquete de audio deja de ser provisional. El flag `provisional` global se
  // mantiene mientras CUALQUIER contenido (p. ej. ilustraciones heredadas
  // provisionales) siga sin producción clínica.
  const approvalPath = path.join(ROOT, 'assets', `verbal-approval.${lang}.json`);
  const approval =
    lang !== 'es' && fs.existsSync(approvalPath)
      ? JSON.parse(fs.readFileSync(approvalPath, 'utf8'))
      : null;

  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(
    manifest,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...(lang !== 'es' ? { lang, baseLang: 'es' } : {}),
        provisional: true,
        ...(approval ? { audioProvisional: false, audioApproval: approval } : {}),
        note:
          'Orden de producción de assets de la audiometría verbal. Locuciones e ilustraciones ' +
          'actuales son PROVISIONALES (síntesis espeak-ng/neural y pictogramas); la producción ' +
          'clínica final sustituye cada archivo conservando su clave.',
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
  console.log(`Manifiesto → ${path.relative(ROOT, manifest)}`);
}

/* --------------------------------- images --------------------------------- */

async function cmdImages({ bands, inventory, glyphs }, lang) {
  let chromium;
  for (const mod of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright']) {
    try { chromium = require(mod).chromium; break; } catch { /* siguiente */ }
  }
  if (!chromium) throw new Error('playwright no disponible (npm i -g playwright o instalar en el proyecto)');
  const executablePath = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
  const { imgDir } = langPaths(lang);

  fs.mkdirSync(imgDir, { recursive: true });
  // Una variante solo genera sus imágenes PROPIAS; las heredables del idioma
  // base no se duplican (el manifiesto las marca `inherited`).
  const inherited = new Set(lang === 'es' ? [] : inventory.inheritedImages);
  const entries = imageEntries(bands).filter(e => !inherited.has(e.key));
  if (!entries.length) {
    console.log(`Sin imágenes propias que generar para ${lang} (todas heredadas del idioma base).`);
    return;
  }
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
    await page.screenshot({ path: path.join(imgDir, `${key}.png`), omitBackground: true });
    process.stdout.write('.');
  }
  await browser.close();
  console.log(`\n${entries.length} ilustraciones provisionales → ${path.relative(ROOT, imgDir)}`);
}

/* ---------------------------------- audio --------------------------------- */

function resolveFfmpeg() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch { /* no en PATH */ }
  const pw = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
  if (fs.existsSync(pw)) return pw;
  throw new Error('ffmpeg no disponible (FFMPEG_BIN o en PATH)');
}

/** Voz espeak-ng por idioma (degradación clásica): es-419 = español LatAm. */
const ESPEAK_VOICES = { es: 'es', 'es-DO': 'es-419' };

/** WAVs provisionales con espeak-ng (voz clásica, ritmo de palabra aislada). */
function synthEspeak(entries, tmp, lang) {
  const voice = ESPEAK_VOICES[lang];
  if (!voice) throw new Error(`Sin voz espeak-ng registrada para ${lang} (use el motor neural)`);
  for (const { key, word } of entries) {
    execFileSync('espeak-ng', ['-v', voice, '-s', '130', '-g', '6', '-w', path.join(tmp, `${key}.wav`), word]);
  }
}

/** WAVs con el motor de voz neural (tools/nos/tts.py: Piper es/es-DO, Celtia gl). */
function synthNeural(entries, tmp, lang) {
  const python = process.env.NOS_PYTHON
    || (fs.existsSync(path.join(ROOT, 'tools', 'nos', '.venv', 'bin', 'python'))
      ? path.join(ROOT, 'tools', 'nos', '.venv', 'bin', 'python')
      : 'python3');
  const batch = path.join(tmp, '_batch.json');
  fs.writeFileSync(batch, JSON.stringify(Object.fromEntries(entries.map(e => [e.key, e.word]))));
  // Un solo proceso para todo el lote: el modelo se carga una vez.
  execFileSync(python, [NOS_TTS, '--lang', lang, '--batch', batch, '--out-dir', tmp], { stdio: 'inherit' });
}

function cmdAudio({ bands }, lang) {
  const ffmpeg = resolveFfmpeg();
  const { audioDir } = langPaths(lang);
  fs.mkdirSync(audioDir, { recursive: true });
  const entries = audioEntries(bands);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verbal-wav-'));

  // Locución PROVISIONAL: es usa espeak-ng salvo VERBAL_TTS=neural; las
  // variantes usan su voz neural (voices.json) salvo VERBAL_TTS=espeak —
  // degradación explícita (voz clásica es-419 LatAm) para entornos sin
  // acceso a los pesos; regenere con la voz neural en cuanto sea posible.
  const forced = process.env.VERBAL_TTS;
  const neural = forced ? forced === 'neural' : lang !== 'es';
  if (neural) synthNeural(entries, tmp, lang);
  else synthEspeak(entries, tmp, lang);

  for (const { key } of entries) {
    const wav = path.join(tmp, `${key}.wav`);
    if (!fs.existsSync(wav)) throw new Error(`Síntesis incompleta: falta ${key}.wav`);
    // m4a AAC mono 44.1k con sonoridad normalizada (loudnorm): la escala de
    // nivel del adaptador presupone recortes a un RMS de referencia común y
    // el objetivo LUFS es el MISMO para todas las voces e idiomas.
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', wav,
      '-af', 'loudnorm=I=-20:TP=-3:LRA=7,silenceremove=start_periods=1:start_threshold=-45dB',
      '-ar', '44100', '-ac', '1', '-c:a', 'aac', '-b:a', '96k',
      path.join(audioDir, `${key}.m4a`),
    ]);
    process.stdout.write('.');
  }
  console.log(`\n${entries.length} locuciones provisionales (${neural ? 'voz neural' : 'espeak-ng'}) → ${path.relative(ROOT, audioDir)}`);
}

/* -------------------------------- registry -------------------------------- */

/**
 * Registro de una VARIANTE: solo el módulo de recortes base64
 * (`verbalAudioClips.<lang>.ts`) — las imágenes se heredan de `es` (el
 * accesor `verbalAssetsByLang.ts` resuelve la herencia) y la vía primaria de
 * reproducción es el base64 en memoria, así que la variante no necesita un
 * registro de `require()` propio mientras no tenga imágenes propias.
 */
function cmdRegistryVariant({ bands, inventory }, lang) {
  const { audioDir } = langPaths(lang);
  const own = inventory.images.filter(k => !inventory.inheritedImages.includes(k));
  if (own.length) {
    throw new Error(
      `La variante ${lang} tiene imágenes PROPIAS sin registro en la app (${own.join(' ')}): ` +
      'extienda cmdRegistryVariant con un registro de require() antes de usarlas.',
    );
  }
  const audio = audioEntries(bands);
  const missing = audio.filter(e => !fs.existsSync(path.join(audioDir, `${e.key}.m4a`)));
  if (missing.length) {
    throw new Error(`Audio ${lang} ausente (genere primero audio --lang ${lang}): ${missing.map(e => e.key).join(' ')}`);
  }

  const constName = `VERBAL_AUDIO_BASE64_${lang.toUpperCase().replace(/-/g, '_')}`;
  const clipsPath = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry', `verbalAudioClips.${lang}.ts`);
  const clipLines = audio
    .map(e => `  ${e.key}: '${fs.readFileSync(path.join(audioDir, `${e.key}.m4a`)).toString('base64')}',`)
    .join('\n');
  const content = `/* eslint-disable */
/* -------------------------------------------------------------------------- */
/*  Recortes de audio de la Audiometría Verbal · variante ${lang} (base64).       */
/*                                                                             */
/*  GENERADO por \`node scripts/verbal-assets.js registry --lang ${lang}\` — NO    */
/*  editar a mano. Misma vía primaria en memoria que verbalAudioClips.ts;      */
/*  cada archivo se sustituye conservando su clave (p. ej. al regenerar con    */
/*  la voz neural o con locutor).                                              */
/* -------------------------------------------------------------------------- */

export const ${constName}: Record<string, string> = {
${clipLines}
};
`;
  fs.writeFileSync(clipsPath, content);
  console.log(`Recortes base64 ${lang} → ${path.relative(ROOT, clipsPath)} (${audio.length} clips)`);
}

function cmdRegistry(mods, lang) {
  if (lang !== 'es') return cmdRegistryVariant(mods, lang);
  const { bands } = mods;
  const { audioDir, imgDir } = langPaths(lang);
  const audio = audioEntries(bands);
  const images = imageEntries(bands);
  const missing = [
    ...audio.filter(e => !fs.existsSync(path.join(audioDir, `${e.key}.m4a`))).map(e => `audio/${e.key}`),
    ...images.filter(e => !fs.existsSync(path.join(imgDir, `${e.key}.png`))).map(e => `img/${e.key}`),
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
import { VERBAL_AUDIO_BASE64 } from './verbalAudioClips';

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

/**
 * Recorte de una palabra objetivo INCRUSTADO en base64 (m4a). Vía primaria de
 * reproducción: se decodifica en memoria (\`decodeAudioData\`), sin depender de
 * la ruta del asset (que en desarrollo es una URL de Metro que la vía nativa
 * por ruta no sabe abrir — motivo por el que el audio no sonaba en Android
 * Studio). \`null\` si no hay recorte para esa palabra.
 */
export const verbalAudioBase64 = (audioKey: string): string | null =>
  VERBAL_AUDIO_BASE64[audioKey] ?? null;

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
    .map(e => `  ${e.key}: '${fs.readFileSync(path.join(audioDir, `${e.key}.m4a`)).toString('base64')}',`)
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

/* ---------------------------------- audit ---------------------------------- */

/**
 * Auditoría fonética Q3.1 (Quisqueya Habla): informe de láminas cuyo contraste
 * colapsa bajo la fonología es-DO. Es un INFORME para las sesiones Q3.3 con el
 * logopeda, no una puerta de CI (el invariante de máquina vive en los tests).
 */
function cmdAudit({ bands, audit }, lang) {
  if (lang !== 'es-DO') {
    throw new Error(`audit solo está definida para es-DO (Q3.1); recibido: ${lang}`);
  }
  const findings = audit.auditEsDoBank(bands);
  if (!findings.length) {
    console.log('Sin láminas en riesgo: ningún contraste colapsa bajo la fonología es-DO.');
    return;
  }
  console.log(`Láminas en riesgo (${findings.length}) — sustituir en las sesiones Q3.3:\n`);
  for (const f of findings) {
    console.log(
      `  banda ${f.band} · ítem ${f.itemId} · «${f.targetWord}» ≈ ${f.collidesWith
        .map(wd => `«${wd}»`)
        .join(', ')} · rasgo: ${f.features.join(', ')}`,
    );
  }
}

/* ----------------------------------- main ---------------------------------- */

async function main() {
  const args = process.argv.slice(2);
  const langIdx = args.indexOf('--lang');
  const lang = langIdx >= 0 ? args[langIdx + 1] : 'es';
  if (langIdx >= 0) args.splice(langIdx, 2);
  if (!lang) throw new Error('--lang requiere un valor (es | gl | es-DO)');
  const cmd = args[0] || 'manifest';

  const mods = loadVerbalModules(lang); // valida el idioma contra el registro de bancos
  if (cmd === 'manifest') return cmdManifest(mods, lang);
  if (cmd === 'images') return cmdImages(mods, lang);
  if (cmd === 'audio') return cmdAudio(mods, lang);
  if (cmd === 'registry') return cmdRegistry(mods, lang);
  if (cmd === 'audit') return cmdAudit(mods, lang);
  throw new Error(`Comando desconocido: ${cmd} (manifest|images|audio|registry|audit)`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
