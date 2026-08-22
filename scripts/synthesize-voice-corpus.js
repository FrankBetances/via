#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Síntesis de los assets del CORPUS GENERAL de voz (herramienta de build-time).
 *
 *   node scripts/synthesize-voice-corpus.js [--lang es|gl|eu|es-DO] [--force]
 *
 * Consume `voice-corpus.json`, filtra por idioma y sintetiza SOLO las
 * locuciones que aún no tienen asset (incremental → sin churn en git). Para
 * cada entrada: voz neural (`tools/nos/tts.py`: Piper es/es-DO, Celtia gl, AhoTTS eu) →
 * WAV → post-proceso ffmpeg (loudnorm + m4a mono 44.1k, IDÉNTICO al de la
 * audiometría verbal, mismo objetivo LUFS) → `assets/voice/<id>.m4a`.
 *
 * Equivalente a `generate-voice-assets.py --lang` del blueprint. Los modelos
 * corren SOLO aquí (build-time); la app nunca incorpora IA en runtime.
 *
 * Tras sintetizar, regenere el mapa: `node scripts/build-voice-asset-map.js`.
 *
 * DEGRADACIÓN sin acceso a los pesos: `VOICE_TTS=espeak` locuta con la voz
 * clásica espeak-ng (es → es, es-DO → es-419 LatAm). `gl` NO tiene fallback
 * espeak fiable → requiere el motor neural (Celtia). Es un escalón por debajo:
 * mantiene el contrato de ids y la sonoridad, y se sustituye archivo a archivo
 * regenerando con la voz neural (misma orden, sin `VOICE_TTS`) cuando haya red.
 *
 * Requisitos (solo para generar, no para compilar la app):
 *   ffmpeg (FFMPEG_BIN o en PATH) + tools/nos (venv + modelos, ver
 *   tools/nos/README.md) para la voz neural, o espeak-ng para la degradación.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { enforceClipTempo, m4aDurationSeconds, MIN_CLIP_MS } = require('./voice-clip-tempo');

const ROOT = path.resolve(__dirname, '..');
const CORPUS = path.join(ROOT, 'voice-corpus.json');
const VOICE_DIR = path.join(ROOT, 'assets', 'voice');
const NOS_TTS = path.join(ROOT, 'tools', 'nos', 'tts.py');

/** Voz espeak-ng por idioma (degradación clásica); gl no tiene fallback. */
const ESPEAK_VOICES = { es: 'es', 'es-DO': 'es-419' };

/**
 * Receta (modelo + params) con la que se locutó cada idioma. Se guarda JUNTO a
 * los assets porque el criterio incremental es «existe el .m4a, luego se salta»,
 * y eso da por buena una locución hecha con OTRA voz: al pasar el castellano de
 * davefx a sharvard, las 91 consignas ya sintetizadas se habrían quedado como
 * estaban y el banco habría acabado mezclando dos voces sin que nadie lo viera.
 * Si la receta declarada en voices.json no coincide con la anotada aquí, ese
 * idioma se regenera ENTERO.
 */
const RECIPE_FILE = path.join(VOICE_DIR, 'recipe.json');

/**
 * `length_scale` de un estilo — REGLA DE VALERIA+ (`LENGTH_SCALE` en su
 * `scripts/generate-voice-assets.py`). El estilo viaja en el id de cada entrada
 * y decide el ritmo con el que se sintetiza; VIA+ lo ignoraba y locutaba todo
 * al mismo ritmo, de modo que una consigna marcada `slow` sonaba igual que las
 * demás. Si el estilo no está en la tabla, manda el lengthScale base de la voz.
 */
function styleLengthScale(lang, style) {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'nos', 'voices.json'), 'utf8'));
    const table = reg.styleLengthScale ?? {};
    const v = Number(table[style]);
    if (Number.isFinite(v) && v > 0) return v;
    return Number(reg.voices?.[lang]?.params?.lengthScale) || 1;
  } catch {
    return 1;
  }
}

function declaredRecipe(lang) {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'nos', 'voices.json'), 'utf8'));
    const v = reg.voices?.[lang];
    if (!v) return null;
    // La tabla de estilos entra en la receta: cambiar el ritmo de un estilo
    // cambia el audio igual que cambiar de modelo, y debe regenerar el banco.
    return JSON.stringify({
      engine: v.engine, model: v.model, params: v.params ?? {},
      styleLengthScale: reg.styleLengthScale ?? {},
    });
  } catch {
    return null;
  }
}

function readRecipes() {
  try {
    return JSON.parse(fs.readFileSync(RECIPE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeRecipe(lang, recipe) {
  const all = readRecipes();
  all[lang] = JSON.parse(recipe);
  fs.writeFileSync(RECIPE_FILE, `${JSON.stringify(all, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = { lang: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--lang') args.lang = argv[(i += 1)];
    else if (a === '--force') args.force = true;
    else throw new Error(`Argumento no reconocido: ${a}`);
  }
  return args;
}

function resolveFfmpeg() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    /* no en PATH */
  }
  const pw = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
  if (fs.existsSync(pw)) return pw;
  throw new Error('ffmpeg no disponible (FFMPEG_BIN o en PATH)');
}

function pythonBin() {
  if (process.env.NOS_PYTHON) return process.env.NOS_PYTHON;
  const venv = path.join(ROOT, 'tools', 'nos', '.venv', 'bin', 'python');
  return fs.existsSync(venv) ? venv : 'python3';
}

/** WAVs con el motor neural (un proceso por lote: el modelo se carga una vez). */
function synthNeural(entries, tmp, lang) {
  // Un lote POR ESTILO: el ritmo se hornea en la síntesis con el length_scale
  // del estilo, nunca con atempo posterior (que estiraría también los silencios
  // y añadiría artefactos de resampleo — el defecto que Valeria ya corrigió).
  const byStyle = new Map();
  for (const e of entries) {
    const st = e.style ?? 'tutor';
    if (!byStyle.has(st)) byStyle.set(st, []);
    byStyle.get(st).push(e);
  }
  for (const [style, group] of [...byStyle.entries()].sort()) {
    const scale = styleLengthScale(lang, style);
    const batch = path.join(tmp, `_batch_${style}.json`);
    fs.writeFileSync(batch, JSON.stringify(Object.fromEntries(group.map(e => [e.id, e.text]))));
    console.log(`  · estilo «${style}»: ${group.length} locuciones · lengthScale ${scale}`);
    execFileSync(pythonBin(), [
      NOS_TTS, '--lang', lang, '--batch', batch, '--out-dir', tmp,
      '--length-scale', String(scale),
    ], { stdio: 'inherit' });
  }
}

/**
 * Re-sintetiza UNA locución con un `lengthScale` propio. Carga el modelo otra
 * vez, así que solo se usa para las pocas que salen por debajo del suelo de
 * duración; el lote normal sigue yendo en un único proceso.
 */
function synthNeuralOne(entry, tmp, lang, lengthScale) {
  execFileSync(
    pythonBin(),
    [NOS_TTS, '--lang', lang, '--text', entry.text, '--out', path.join(tmp, `${entry.id}.wav`),
      '--length-scale', String(lengthScale)],
    { stdio: 'inherit' },
  );
}

/** WAVs con espeak-ng (degradación clásica; no cubre gl). */
function synthEspeak(entries, tmp, lang) {
  const voice = ESPEAK_VOICES[lang];
  if (!voice) {
    throw new Error(`Sin voz espeak-ng para ${lang} (use el motor neural: quite VOICE_TTS)`);
  }
  for (const e of entries) {
    execFileSync('espeak-ng', [
      '-v', voice, '-s', '150', '-g', '4',
      '-w', path.join(tmp, `${e.id}.wav`), e.text,
    ]);
  }
}

function synthesizeLang(corpus, lang, force) {
  const all = corpus.filter(e => e.lang === lang);
  if (!all.length) {
    console.log(`· ${lang}: sin entradas en el corpus (nada que sintetizar)`);
    return 0;
  }
  // Incremental, pero NO ciego: además de las que faltan, entran las que ya
  // están pero salieron por debajo del suelo de duración. Sin esta segunda
  // condición un recorte defectuoso ya commiteado era inmortal —existe, luego
  // se salta— y ni cambiar la voz ni subir el lengthScale lo tocaban jamás.
  const tooShort = e => {
    if (MIN_CLIP_MS <= 0) return false;
    const s = m4aDurationSeconds(path.join(VOICE_DIR, `${e.id}.m4a`));
    return s != null && s * 1000 < MIN_CLIP_MS;
  };
  // Cambiar de voz (o de sus params) invalida TODO lo locutado con la anterior:
  // mezclarlas en un mismo banco es peor que no tener banco, porque el paciente
  // oye dos locutores distintos en la misma prueba y nada lo delata en el diff.
  const recipe = declaredRecipe(lang);
  const recipeChanged = recipe != null && JSON.stringify(readRecipes()[lang] ?? null) !== recipe;
  if (recipeChanged) {
    const prev = readRecipes()[lang];
    console.log(
      `· ${lang}: la receta ha cambiado (${prev ? prev.model : 'sin anotar'} → ${JSON.parse(recipe).model})`
        + ' — se regenera el banco entero, no solo lo que falta.',
    );
  }
  const pending = force || recipeChanged
    ? all
    : all.filter(e => !fs.existsSync(path.join(VOICE_DIR, `${e.id}.m4a`)) || tooShort(e));
  if (!pending.length) {
    console.log(`· ${lang}: ${all.length} locuciones ya sintetizadas (incremental, nada que hacer)`);
    return 0;
  }

  const ffmpeg = resolveFfmpeg();
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-wav-'));

  const espeak = process.env.VOICE_TTS === 'espeak';
  if (espeak) synthEspeak(pending, tmp, lang);
  else synthNeural(pending, tmp, lang);

  // Se codifica a un directorio temporal y solo se publica si pasa el suelo de
  // duración, igual que hace `verbal-assets.js` con su banco. Escribiendo
  // directamente sobre `assets/voice`, una corrida que no converge deja en el
  // árbol locuciones PEORES que las que ya había —y el workflow las commitea
  // antes de evaluar el resultado—: así es como «Tapa» pasó de 244 ms a los
  // 163 ms que hoy están en la rama. Si esto falla, el árbol se queda como
  // estaba y el aviso del workflow es lo único que cambia.
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-m4a-'));
  // m4a AAC mono 44.1k con sonoridad normalizada (loudnorm): MISMO objetivo
  // LUFS que la audiometría verbal, para sonoridad homogénea entre idiomas.
  const encode = e => {
    const wav = path.join(tmp, `${e.id}.wav`);
    if (!fs.existsSync(wav)) throw new Error(`Síntesis incompleta: falta ${e.id}.wav`);
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', wav,
      '-af', 'loudnorm=I=-20:TP=-3:LRA=7,silenceremove=start_periods=1:start_threshold=-45dB',
      '-ar', '44100', '-ac', '1', '-c:a', 'aac', '-b:a', '96k',
      path.join(staging, `${e.id}.m4a`),
    ]);
  };
  for (const e of pending) {
    encode(e);
    process.stdout.write('.');
  }
  console.log('');

  // Mismo suelo de duración que la audiometría verbal, y por el mismo motivo:
  // por aquí pasan los MODELOS HABLADOS del T.A.R., que son palabras sueltas
  // para repetir. Sin esta puerta se colaron locuciones como «Tapa» en 140 ms
  // o «Apto» en 163 ms —un chasquido, no una palabra— y el módulo parecía no
  // tener voz neuronal cuando lo que tenía era una inservible.
  enforceClipTempo({
    items: pending,
    fileFor: e => path.join(staging, `${e.id}.m4a`),
    labelFor: e => e.text,
    lang,
    sourceFor: e => path.join(tmp, `${e.id}.wav`),
    // La regla de tres tiene que partir de la escala con la que se sintetizó
    // ESTA locución, que ahora es la de su estilo y no la base de la voz.
    baseScaleFor: e => styleLengthScale(lang, e.style ?? 'tutor'),
    resynth: espeak ? null : (e, scale) => { synthNeuralOne(e, tmp, lang, scale); encode(e); },
  });

  for (const e of pending) {
    fs.copyFileSync(path.join(staging, `${e.id}.m4a`), path.join(VOICE_DIR, `${e.id}.m4a`));
  }
  // Solo tras publicar: si la síntesis falla, la receta anotada sigue siendo la
  // del banco que de verdad está en el árbol, y la próxima corrida vuelve a
  // intentar la regeneración completa en lugar de darla por hecha.
  if (recipe && !espeak) writeRecipe(lang, recipe);
  console.log(
    `✓ ${lang}: ${pending.length} locuciones (${espeak ? 'espeak-ng' : 'voz neural'}) → ${path.relative(ROOT, VOICE_DIR)}`,
  );
  return pending.length;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(CORPUS)) {
    console.error(`✗ Falta ${path.relative(ROOT, CORPUS)} — ejecuta antes: node scripts/export-voice-corpus.js`);
    process.exit(1);
  }
  const { corpus } = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
  const langs = args.lang ? [args.lang] : [...new Set(corpus.map(e => e.lang))].sort();
  // Un idioma pedido sin entradas (p. ej. gl/es-DO aún sin consignas revisadas)
  // NO es un error: no hay nada que sintetizar y se omite. `synthesizeLang` ya
  // lo informa; esto solo evita abortar una corrida `all` por los vacíos.

  let total = 0;
  for (const lang of langs) total += synthesizeLang(corpus, lang, args.force);
  if (total) console.log(`\nRegenere el mapa: node scripts/build-voice-asset-map.js`);
}

main();
