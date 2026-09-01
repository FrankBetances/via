#!/usr/bin/env node
/**
 * Pipeline de assets de la Audiometría Verbal (herramienta de desarrollo).
 *
 *   node scripts/verbal-assets.js manifest [--lang es|gl|eu|es-DO]  → estado del banco + manifiesto
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
 * VOZ: el motor NEURAL (tools/nos/tts.py — Piper es/es-DO, Celtia gl, Maider
 * eu) para todos los idiomas. `VERBAL_TTS=espeak` degrada a la voz clásica en
 * entornos sin acceso a los pesos (no cubre gl ni eu). El post-proceso ffmpeg (loudnorm, m4a) es
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

const { enforceClipTempo } = require('./voice-clip-tempo');

const ROOT = path.resolve(__dirname, '..');
const AUDIO_ROOT = path.join(ROOT, 'assets', 'audio', 'verbal');
const IMG_ROOT = path.join(ROOT, 'assets', 'img', 'verbal');
const REGISTRY = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry', 'verbalAssets.ts');
const CLIPS = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry', 'verbalAudioClips.ts');
const NOS_TTS = path.join(ROOT, 'tools', 'nos', 'tts.py');

/**
 * Lado de las ilustraciones, en píxeles.
 *
 * `WordCard` las dibuja a 72–96 pt (`imgSide`), así que 96 × 3 = 288 cubre la
 * densidad más alta que sirve la app. Subirlo no añade un solo píxel visible y
 * sí memoria: React Native descomprime cada PNG a un bitmap de ancho × alto × 4
 * bytes, de modo que el coste en RAM va con el CUADRADO de este número y es
 * indiferente a lo bien que comprima el fichero. A 512 el banco costaba 97 MB
 * de bitmap; a 288 cuesta 31 MB.
 *
 * El diseño se expresa abajo en las medidas originales de 512 y se escala por
 * `SIDE_SCALE`: cambiar solo esta constante reescala el pictograma entero sin
 * tocar la maqueta.
 */
const IMG_SIDE = 288;
const IMG_DESIGN_SIDE = 512;
const SIDE_SCALE = IMG_SIDE / IMG_DESIGN_SIDE;

/** Medida del diseño (en la rejilla de 512) → píxeles CSS del lienzo real. */
const px = n => `${+(n * SIDE_SCALE).toFixed(2)}px`;

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

/** Pictogramas propios de un idioma completo (`VERBAL_GLYPHS_GL`, `_EU`…). */
function langGlyphs(outDir, lang) {
  if (lang === 'es' || lang === 'es-DO') return null;
  try {
    const mod = require(path.join(outDir, `verbalAudiometryLists.${lang}.js`));
    return mod[`VERBAL_GLYPHS_${lang.toUpperCase().replace(/-/g, '_')}`] ?? null;
  } catch {
    return null; // idioma sin mapa propio: se usan solo los castellanos
  }
}

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
  // BANCO PRESTADO: `ca` y `en` no tienen banco propio, así que las palabras
  // que se presentarían son CASTELLANAS. Sintetizarlas con su voz produce lo
  // que produjo el run 25 de este workflow: 37 ficheros de una voz inglesa
  // diciendo «caballo», «botella» y «cebolla», commiteados y listos para
  // presentarse como estímulo clínico. El runtime ya reproduce los recortes de
  // la lengua que presta las palabras (`verbalStimulusLang`); aquí se cierra el
  // otro extremo, que es donde se fabricaban.
  const borrowedFrom = banks.VERBAL_BANK_BORROWED[lang];
  if (borrowedFrom) {
    console.error(
      `✗ '${lang}' no tiene banco verbal propio: presenta las palabras de `
      + `'${borrowedFrom}'. No se sintetizan recortes suyos — la app usa los de `
      + `'${borrowedFrom}'. Cuando exista un banco clínico propio, vacíe su `
      + 'entrada en VERBAL_BANK_BORROWED y vuelva a lanzar esto.',
    );
    process.exit(2);
  }
  return {
    bands: banks.getVerbalBands(lang),
    inventory: banks.collectLangAssetInventory(lang),
    // Pictogramas: los del castellano MÁS los propios del idioma, que es la
    // misma resolución que hace la app en `verbalGlyphForLang`. Los módulos de
    // listas ya los compila tsc al seguir los imports de `verbalAudiometryBanks`.
    glyphs: {
      ...require(path.join(out, 'verbalAudiometryGlyphs.js')).VERBAL_GLYPHS,
      ...(langGlyphs(out, lang) ?? {}),
    },
    audit: require(path.join(out, 'verbalAudiometryAudit.es-DO.js')),
    // `null` = idioma COMPLETO (gl, eu); un código = variante que hereda de él.
    baseLang: banks.VERBAL_BANK_BASE[lang] ?? null,
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

  // Aprobaciones clínicas de un idioma/variante: si existe
  // assets/verbal-approval.<lang>.json se incrustan en el manifiesto y el
  // artefacto correspondiente deja de ser provisional. El archivo admite un
  // registro suelto (formato histórico de es-DO) o una lista, porque los
  // artefactos se firman por separado y en momentos distintos:
  //   · scope 'audio' → locuciones (Q4.4/T4.4);
  //   · scope 'bank'  → listas de estímulos A–D (Q3.3/T3.3; el gallego se
  //     firmó antes de tener audio, así que la firma del banco NO puede
  //     implicar la del audio).
  // El flag `provisional` global se mantiene mientras CUALQUIER contenido
  // (p. ej. ilustraciones heredadas provisionales) siga sin producción clínica.
  //
  // El castellano ESTABA excluido (`lang !== 'es'`) por herencia: era el idioma
  // base, el único que existía, y su estado provisional se daba por supuesto.
  // Con las cuatro voces neuronales firmadas —ACOPROS para es, gl y es-DO;
  // Ulertuz para eu— esa exclusión dejaba al castellano como el único banco sin
  // forma de registrar su aprobación: el manifiesto lo seguía declarando
  // provisional aunque estuviera firmado. Ahora todos los idiomas admiten
  // registro.
  const approvalPath = path.join(ROOT, 'assets', `verbal-approval.${lang}.json`);
  const approvals = fs.existsSync(approvalPath)
    ? [JSON.parse(fs.readFileSync(approvalPath, 'utf8'))].flat()
    : [];
  // OJO con `superseded`: las firmas retiradas se quedan en el registro a
  // propósito —el castellano conserva la de davefx, el dominicano la de
  // ACOPROS— para que el expediente cuente por qué se cambió. Buscar «la
  // primera con este scope» cogía justamente esa: el manifiesto castellano
  // viajaba declarando `audioProvisional: false` con la firma de una voz
  // RETIRADA (davefx) mientras el banco ya era sharvard. Un manifiesto es lo
  // que acompaña al asset en el expediente: solo puede citar la firma VIGENTE.
  const approvalOf = scope =>
    approvals.find(
      a => (a.scope ?? 'audio') === scope && a.status !== 'superseded',
    ) ?? null;
  const audioApproval = approvalOf('audio');
  const bankApproval = approvalOf('bank');

  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(
    manifest,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...(lang !== 'es' ? { lang, baseLang: 'es' } : {}),
        provisional: true,
        ...(audioApproval ? { audioProvisional: false, audioApproval } : {}),
        ...(bankApproval ? { bankProvisional: false, bankApproval } : {}),
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
  const page = await browser.newPage({
    viewport: { width: IMG_SIDE, height: IMG_SIDE },
    deviceScaleFactor: 1,
  });

  for (const { key, word } of entries) {
    const glyph = glyphs[word];
    // Pictograma emoji (provisional) o tile de inicial (asset pendiente de
    // ilustrador). Mismo lenguaje visual que el placeholder de WordCard.
    const body = glyph
      ? `<div class="wrap"><span class="g">${glyph}</span></div>`
      : `<div class="wrap tile"><span class="l">${word.charAt(0).toUpperCase()}</span><span class="w">${word}</span></div>`;
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      * { margin:0; box-sizing:border-box }
      body { width:${px(512)}; height:${px(512)}; display:grid; place-items:center; background:transparent;
             font-family:"Noto Color Emoji","Segoe UI",system-ui,sans-serif }
      .wrap { width:${px(512)}; height:${px(512)}; display:grid; place-items:center }
      .g { font-size:${px(380)}; line-height:1 }
      .tile { width:${px(440)}; height:${px(440)}; border-radius:${px(72)}; background:#F5F2EC;
              border:${px(10)} dashed #DDD5C7; display:flex; flex-direction:column;
              align-items:center; justify-content:center; gap:${px(12)} }
      .l { font-size:${px(190)}; font-weight:800; color:#9A9183;
           font-family:"Segoe UI",system-ui,sans-serif }
      .w { font-size:${px(44)}; font-weight:700; color:#6B635A;
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

/**
 * Voz espeak-ng por idioma (degradación clásica, para entornos sin acceso a
 * los pesos neuronales). `es-419` = español LatAm.
 *
 * espeak-ng SÍ trae voces gallega y vasca, pero NO se registran aquí a
 * propósito: su calidad no da para un estímulo clínico y tenerlas disponibles
 * invitaría a empaquetar un banco que suena peor que la voz del propio
 * dispositivo. `gl` y `eu` se sintetizan con el motor neural o no se
 * sintetizan (ver `tools/nos/voices.json`).
 */
const ESPEAK_VOICES = { es: 'es', 'es-DO': 'es-419' };

/** WAVs provisionales con espeak-ng (voz clásica, ritmo de palabra aislada). */
function synthEspeak(entries, tmp, lang) {
  const voice = ESPEAK_VOICES[lang];
  if (!voice) throw new Error(`Sin voz espeak-ng registrada para ${lang} (use el motor neural)`);
  for (const { key, word } of entries) {
    execFileSync('espeak-ng', ['-v', voice, '-s', '130', '-g', '6', '-w', path.join(tmp, `${key}.wav`), word]);
  }
}

/** WAVs con el motor de voz neural (tools/nos/tts.py: Piper es/es-DO, Celtia gl,
 *  voz vasca pendiente de ADR — el script falla con un mensaje claro si no la hay). */
function nosPython() {
  return process.env.NOS_PYTHON
    || (fs.existsSync(path.join(ROOT, 'tools', 'nos', '.venv', 'bin', 'python'))
      ? path.join(ROOT, 'tools', 'nos', '.venv', 'bin', 'python')
      : 'python3');
}

function synthNeural(entries, tmp, lang) {
  const batch = path.join(tmp, '_batch.json');
  fs.writeFileSync(batch, JSON.stringify(Object.fromEntries(entries.map(e => [e.key, e.word]))));
  // Un solo proceso para todo el lote: el modelo se carga una vez.
  execFileSync(nosPython(), [NOS_TTS, '--lang', lang, '--batch', batch, '--out-dir', tmp], { stdio: 'inherit' });
}

/**
 * Re-sintetiza UNA locución con un `lengthScale` propio. Carga el modelo otra
 * vez, así que solo se usa para los pocos recortes que salen por debajo del
 * suelo de duración; el lote normal sigue yendo en un único proceso.
 */
function synthNeuralOne(entry, tmp, lang, lengthScale) {
  execFileSync(
    nosPython(),
    [NOS_TTS, '--lang', lang, '--text', entry.word, '--out', path.join(tmp, `${entry.key}.wav`),
      '--length-scale', String(lengthScale)],
    { stdio: 'inherit' },
  );
}

function cmdAudio({ bands }, lang) {
  const ffmpeg = resolveFfmpeg();
  const { audioDir } = langPaths(lang);
  fs.mkdirSync(audioDir, { recursive: true });
  const entries = audioEntries(bands);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verbal-wav-'));

  // Locución PROVISIONAL con la voz NEURAL declarada en `tools/nos/voices.json`
  // para TODOS los idiomas, castellano incluido. El castellano usaba espeak-ng
  // por defecto por herencia histórica, de modo que un `audio --lang es` en
  // local sustituía sin avisar los recortes neurales por los clásicos; la voz
  // castellana ya está decidida (Piper es_ES-sharvard-medium) y es la de por
  // defecto. `VERBAL_TTS=espeak` sigue disponible como degradación EXPLÍCITA
  // para entornos sin acceso a los pesos, y no cubre gl ni eu.
  const neural = process.env.VERBAL_TTS !== 'espeak';
  if (neural) synthNeural(entries, tmp, lang);
  else synthEspeak(entries, tmp, lang);

  // Se codifica a un directorio temporal y solo se publica el banco entero si
  // pasa la verificación de ritmo. Escribir directamente sobre `audioDir`
  // dejaba los .m4a nuevos en el árbol aunque el paso posterior fallase, con
  // el módulo base64 (`verbalAudioClips.<lang>.ts`) todavía apuntando a los
  // viejos: dos versiones distintas del mismo banco en el mismo commit.
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'verbal-m4a-'));
  // m4a AAC mono 44.1k con sonoridad normalizada (loudnorm): la escala de
  // nivel del adaptador presupone recortes a un RMS de referencia común y
  // el objetivo LUFS es el MISMO para todas las voces e idiomas.
  const encode = key => {
    const wav = path.join(tmp, `${key}.wav`);
    if (!fs.existsSync(wav)) throw new Error(`Síntesis incompleta: falta ${key}.wav`);
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', wav,
      '-af', 'loudnorm=I=-20:TP=-3:LRA=7,silenceremove=start_periods=1:start_threshold=-45dB',
      '-ar', '44100', '-ac', '1', '-c:a', 'aac', '-b:a', '96k',
      path.join(staging, `${key}.m4a`),
    ]);
  };
  for (const { key } of entries) {
    encode(key);
    process.stdout.write('.');
  }
  console.log('');
  // El realentizado por recorte solo es posible con el motor neural, que
  // acepta `--length-scale`; con espeak esto queda como simple comprobación.
  enforceClipTempo({
    items: entries,
    fileFor: e => path.join(staging, `${e.key}.m4a`),
    labelFor: e => e.word,
    lang,
    sourceFor: e => path.join(tmp, `${e.key}.wav`),
    resynth: neural
      ? (e, scale) => { synthNeuralOne(e, tmp, lang, scale); encode(e.key); }
      : null,
  });

  for (const { key } of entries) {
    fs.copyFileSync(path.join(staging, `${key}.m4a`), path.join(audioDir, `${key}.m4a`));
  }
  console.log(`${entries.length} locuciones provisionales (${neural ? 'voz neural' : 'espeak-ng'}) → ${path.relative(ROOT, audioDir)}`);
}

/* -------------------------------- registry -------------------------------- */

/**
 * Registro de una VARIANTE: solo el módulo de recortes base64
 * (`verbalAudioClips.<lang>.ts`) — las imágenes se heredan de `es` (el
 * accesor `verbalAssetsByLang.ts` resuelve la herencia) y la vía primaria de
 * reproducción es el base64 en memoria, así que la variante no necesita un
 * registro de `require()` propio mientras no tenga imágenes propias.
 */
function cmdRegistryVariant({ bands, inventory, baseLang, glyphs }, lang) {
  const { audioDir } = langPaths(lang);
  const own = inventory.images.filter(k => !inventory.inheritedImages.includes(k));

  // Imágenes propias sin registro de `require()` en la app.
  //
  // En una VARIANTE (es-DO, que hereda de es) esto es un error: si el logopeda
  // sustituyó una lámina, su ilustración tiene que existir o la sustitución se
  // pierde en silencio.
  //
  // En un idioma COMPLETO (gl, eu) es el comportamiento DISEÑADO: su banco es
  // propio, muchas palabras no existen en castellano y la tarjeta degrada a
  // pictograma y luego a inicial (ver verbalAudiometryLists.gl.ts y
  // `verbalImageSourceForLang`). Bloquear aquí acoplaba el registro del AUDIO
  // —que es el estímulo clínico— a un asunto de ilustraciones, y dejaba al
  // gallego sin locuciones por una razón que no tiene que ver con el audio.
  if (own.length && baseLang) {
    throw new Error(
      `La variante ${lang} hereda de '${baseLang}' pero tiene imágenes PROPIAS sin registro ` +
      `en la app (${own.join(' ')}): extienda cmdRegistryVariant con un registro de require().`,
    );
  }
  if (own.length) {
    // Se avisa Y se comprueba que la degradación llega a pictograma: caer a la
    // inicial de la palabra deja la lámina sin apoyo visual, que en las bandas
    // pediátricas (A/B, solo imágenes) la haría inservible.
    const words = new Map(imageEntries(bands).map(e => [e.key, e.word]));
    const withoutGlyph = own.filter(k => !glyphs[words.get(k)]);
    console.log(
      `${lang}: ${own.length} ilustraciones propias sin archivo; esas tarjetas ` +
      'degradan a pictograma (comportamiento previsto para un idioma completo).',
    );
    if (withoutGlyph.length) {
      throw new Error(
        `${lang}: ${withoutGlyph.length} palabra(s) se quedarían sin imagen Y sin pictograma ` +
        `(${withoutGlyph.join(' ')}): añádalas a VERBAL_GLYPHS_${lang.toUpperCase().replace(/-/g, '_')} ` +
        `o genere sus ` +
        `ilustraciones con \`images --lang ${lang}\`.`,
      );
    }
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
  const content = `/* -------------------------------------------------------------------------- */
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
  const clips = `/* -------------------------------------------------------------------------- */
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
  if (!lang) throw new Error('--lang requiere un valor (es | gl | eu | es-DO)');
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
