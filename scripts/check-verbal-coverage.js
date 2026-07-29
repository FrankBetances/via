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
 *   · en el EMPAQUETADO sería bloqueante (`--strict`) — ahí un APK sin sus
 *     locuciones es un APK defectuoso, no una degradación aceptada.
 *
 * Sin la primera mitad, un fallo de una voz se lleva por delante el trabajo de
 * las demás. Sin la segunda, una voz ausente viaja hasta producción sin que
 * nadie se entere.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

  const rows = [];
  for (const lang of banks.VERBAL_BANK_LANGS) {
    const keys = audioKeys(banks.getVerbalBands(lang));
    const dir = audioDir(lang);
    const missing = keys.filter(k => !fs.existsSync(path.join(dir, `${k}.m4a`)));
    rows.push({ lang, total: keys.length, missing });
  }

  console.log('Cobertura de locuciones del banco verbal\n');
  for (const { lang, total, missing } of rows) {
    const have = total - missing.length;
    const mark = missing.length === 0 ? '✓' : '·';
    console.log(`  ${mark} ${lang.padEnd(6)} ${String(have).padStart(3)}/${total}`);
    if (missing.length) {
      // Se listan acotadas: con un banco entero sin sintetizar, volcar las 38
      // claves no aporta nada sobre «no hay ninguna».
      const shown = missing.slice(0, 8).join(' ');
      const rest = missing.length > 8 ? ` … (+${missing.length - 8})` : '';
      console.log(`      faltan: ${shown}${rest}`);
    }
  }

  const incomplete = rows.filter(r => r.missing.length);
  if (!incomplete.length) {
    console.log('\n✓ Todos los idiomas registrados tienen su banco locutado.');
    return 0;
  }

  const langs = incomplete.map(r => r.lang).join(', ');
  if (strict) {
    console.error(
      `\n✗ Faltan locuciones en: ${langs}.\n` +
      '  Genérelas con el workflow de voz (o `verbal-assets.js audio --lang <lang>`) ' +
      'antes de empaquetar.',
    );
    return 1;
  }
  console.log(
    `\n· Sin locutar: ${langs}. Esos idiomas degradan a la voz del sistema, que es ` +
    'una degradación declarada; no bloquea la síntesis del resto.',
  );
  return 0;
}

process.exit(main());
