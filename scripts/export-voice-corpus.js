#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Exportador del corpus de voz (herramienta de build-time).
 *
 *   node scripts/export-voice-corpus.js   → voice-corpus.json (contrato serializado)
 *
 * Compila el módulo PURO `src/Voice/viaVoiceCorpus.ts` (y sus dependencias
 * puras, incluida la tabla de consignas de Funciones Ejecutivas) a CommonJS en
 * un directorio temporal con el `tsc` del proyecto, lo ejecuta, invoca
 * `buildVoiceCorpus()` y vuelca `voice-corpus.json` a la raíz. ABORTA si hay
 * colisión de ids. Si algún módulo del corpus deja de ser puro (importa RN/UI),
 * la compilación/ejecución falla AQUÍ, nunca en la app (invariante P7).
 *
 * El JSON no lleva marca de tiempo: regenerar solo produce diffs de las cadenas
 * cambiadas (sin churn en git — invariante P4).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'voice-corpus.json');

function loadCorpusModule() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-cjs-'));
  const localTsc = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  const tsc = fs.existsSync(localTsc) ? localTsc : 'tsc'; // local o del PATH
  // tsc incluye en el programa todos los ficheros alcanzables por imports desde
  // el punto de entrada; con --rootDir src se preserva la estructura de
  // carpetas en el outDir (Voice/…, Screens/ExecutiveFunctions/…).
  execFileSync(
    tsc,
    [
      path.join(SRC, 'Voice', 'viaVoiceCorpus.ts'),
      '--outDir', tmp,
      '--rootDir', SRC,
      '--module', 'commonjs',
      '--target', 'es2019',
      '--moduleResolution', 'node',
      '--esModuleInterop',
      '--skipLibCheck',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return require(path.join(tmp, 'Voice', 'viaVoiceCorpus.js'));
}

function main() {
  const { buildVoiceCorpus, voiceCorpusStats } = loadCorpusModule();
  const corpus = buildVoiceCorpus();
  const stats = voiceCorpusStats(corpus);

  if (stats.collisions.length) {
    console.error(`✗ Colisión de ids en el corpus (${stats.collisions.length}):`);
    for (const id of stats.collisions) console.error(`    ${id}`);
    process.exit(1);
  }

  const sorted = [...corpus].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const payload = {
    schema: 'via-plus/voice-corpus@1',
    entries: stats.entries,
    byLang: stats.byLang,
    byStyle: stats.byStyle,
    bySource: stats.bySource,
    corpus: sorted,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`✓ ${path.relative(ROOT, OUT)} — ${stats.entries} locuciones`, stats.byLang);
}

main();
