#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Cobertura de locuciones del banco verbal, idioma a idioma.
 *
 *   node scripts/check-verbal-coverage.js            → informe (siempre sale 0)
 *   node scripts/check-verbal-coverage.js --strict   → sale 1 si falta alguna
 *
 * Portado de `check-voice-corpus-coverage.js` de Valeria+, donde cumple la
 * segunda mitad de un diseño en dos partes:
 *
 *   · en la SÍNTESIS es informativo — que una voz falle no debe tirar el lote
 *     entero, porque el resto de idiomas sí se ha generado y hay que
 *     commitearlo; el idioma que falta degrada a la voz del sistema, que es
 *     una degradación declarada y funcional;
 *   · en el EMPAQUETADO es bloqueante (`--strict`, cableado en
 *     `android-release.yml`) — ahí un APK sin sus locuciones es un APK
 *     defectuoso, no una degradación aceptada.
 *
 * En modo `--strict` el criterio NO es «todos los idiomas al 100 %», sino
 * COHERENCIA CON `VERBAL_AUDIO_PENDING`, que es la declaración revisada de qué
 * idiomas se sabe que aún no tienen locuciones propias. Se comprueba en los dos
 * sentidos, igual que las pruebas de trazabilidad de la aprobación clínica:
 *
 *   · un idioma NO declarado pendiente al que le falten recortes → error: la
 *     app promete un estímulo locutado que no existe;
 *   · un idioma declarado pendiente que YA los tiene todos → error también:
 *     la pantalla sigue advirtiendo al profesional de que el estímulo no es el
 *     definitivo cuando ya lo es, y el aviso pasa a ser falso. Basta sacarlo de
 *     la lista.
 *
 * Sin la primera mitad, un fallo de una voz se lleva por delante el trabajo de
 * las demás. Sin la segunda, una voz ausente viaja hasta producción sin que
 * nadie se entere.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { m4aDurationSeconds, MIN_CLIP_MS } = require('./voice-clip-tempo');

const ROOT = path.resolve(__dirname, '..');

function loadBanks() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'verbal-cov-'));
  const tsc = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  const srcDir = path.join(ROOT, 'src', 'Screens', 'VerbalAudiometry');
  execFileSync(tsc, [
    path.join(srcDir, 'verbalAudiometryBanks.ts'),
    '--outDir', out, '--module', 'commonjs', '--target', 'es2019', '--skipLibCheck',
  ]);
  return require(path.join(out, 'verbalAudiometryBanks.js'));
}

/** Directorio de recortes de un idioma (`es` vive en la raíz, el resto en subcarpeta). */
const audioDir = lang =>
  path.join(ROOT, 'assets', 'audio', 'verbal', ...(lang === 'es' ? [] : [lang]));

/** Claves de audio únicas del banco de un idioma. */
const audioKeys = bands => {
  const keys = new Set();
  for (const band of bands) for (const item of band.items) keys.add(item.audio);
  return [...keys].sort();
};

function main() {
  const strict = process.argv.includes('--strict');
  const banks = loadBanks();
  const pending = new Set(banks.VERBAL_AUDIO_PENDING);

  const rows = [];
  for (const lang of banks.VERBAL_BANK_LANGS) {
    const keys = audioKeys(banks.getVerbalBands(lang));
    const dir = audioDir(lang);
    const missing = keys.filter(k => !fs.existsSync(path.join(dir, `${k}.m4a`)));
    // Ritmo: un recorte presente pero atropellado es peor que uno ausente —el
    // ausente al menos degrada a la voz del sistema, y este se presenta como
    // estímulo válido. El banco castellano viajó así hasta producción.
    const tooShort = keys
      .filter(k => !missing.includes(k))
      .map(k => ({ key: k, seconds: m4aDurationSeconds(path.join(dir, `${k}.m4a`)) }))
      .filter(m => m.seconds != null && MIN_CLIP_MS > 0 && m.seconds * 1000 < MIN_CLIP_MS)
      .sort((a, b) => a.seconds - b.seconds);
    rows.push({ lang, total: keys.length, missing, tooShort, declaredPending: pending.has(lang) });
  }

  console.log('Cobertura de locuciones del banco verbal\n');
  for (const { lang, total, missing, declaredPending } of rows) {
    const have = total - missing.length;
    const mark = missing.length === 0 ? '✓' : declaredPending ? '·' : '✗';
    const tag = declaredPending ? '  (audio declarado pendiente)' : '';
    console.log(`  ${mark} ${lang.padEnd(6)} ${String(have).padStart(3)}/${total}${tag}`);
    if (missing.length) {
      // Se listan acotadas: con un banco entero sin sintetizar, volcar las 38
      // claves no aporta nada sobre «no hay ninguna».
      const shown = missing.slice(0, 8).join(' ');
      const rest = missing.length > 8 ? ` … (+${missing.length - 8})` : '';
      console.log(`      faltan: ${shown}${rest}`);
    }
    const short = rows.find(r => r.lang === lang).tooShort;
    if (short.length) {
      console.log(
        `      atropelladas (< ${MIN_CLIP_MS} ms): ` +
        short.slice(0, 6).map(m => `${m.key} ${(m.seconds * 1000).toFixed(0)} ms`).join(' · ') +
        (short.length > 6 ? ` … (+${short.length - 6})` : ''),
      );
    }
  }

  const incomplete = rows.filter(r => r.missing.length);

  if (!strict) {
    if (!incomplete.length) {
      console.log('\n✓ Todos los idiomas registrados tienen su banco locutado.');
      return 0;
    }
    console.log(
      `\n· Sin locutar: ${incomplete.map(r => r.lang).join(', ')}. Esos idiomas degradan ` +
      'a la voz del sistema, que es una degradación declarada; no bloquea la síntesis del resto.',
    );
    return 0;
  }

  /* ----------------------- coherencia con la declaración ------------------- */

  const problems = [];
  for (const { lang, tooShort } of rows) {
    if (tooShort.length) {
      problems.push(
        `'${lang}': ${tooShort.length} locución(es) por debajo de ${MIN_CLIP_MS} ms ` +
        `(la más corta, ${tooShort[0].key}, ${(tooShort[0].seconds * 1000).toFixed(0)} ms). ` +
        'Un estímulo atropellado no mide reconocimiento de palabra: regenere el banco con el ' +
        'workflow de voz, que ya realentiza recorte a recorte.',
      );
    }
  }
  for (const { lang, missing, declaredPending, total } of rows) {
    if (missing.length && !declaredPending) {
      problems.push(
        `'${lang}': faltan ${missing.length} de ${total} locuciones y NO está declarado ` +
        'como pendiente. O se generan (workflow de voz) o se añade el idioma a ' +
        'VERBAL_AUDIO_PENDING en verbalAudiometryBanks.ts.',
      );
    }
    if (!missing.length && declaredPending) {
      problems.push(
        `'${lang}': ya tiene sus ${total} locuciones pero sigue en VERBAL_AUDIO_PENDING. ` +
        'La pantalla advierte al profesional de que el estímulo no es el definitivo cuando ' +
        'ya lo es: quítelo de la lista.',
      );
    }
  }

  if (problems.length) {
    console.error(`\n✗ ${problems.length} incoherencia(s) entre las locuciones y su declaración:`);
    for (const p of problems) console.error(`  · ${p}`);
    return 1;
  }

  const pendientes = rows.filter(r => r.declaredPending).map(r => r.lang);
  console.log(
    `\n✓ Locuciones coherentes con VERBAL_AUDIO_PENDING${
      pendientes.length ? ` (pendientes declarados: ${pendientes.join(', ')})` : ''
    }.`,
  );
  return 0;
}

process.exit(main());
