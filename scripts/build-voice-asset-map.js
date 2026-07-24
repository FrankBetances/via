#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Generador del mapa id→asset de voz (herramienta de build-time).
 *
 *   node scripts/build-voice-asset-map.js   → reescribe src/Voice/viaVoiceAssets.ts
 *
 * Cruza `voice-corpus.json` con los ficheros reales de `assets/voice/` y
 * REESCRIBE `src/Voice/viaVoiceAssets.ts` con un `require()` LITERAL por
 * locución con asset presente (Metro no admite requires dinámicos). Solo
 * entran ids con fichero `.m4a`. Mientras no haya assets, el mapa queda vacío
 * y `viaVoice.speak` cae a la voz del sistema (sin regresión).
 *
 * ARCHIVO GENERADO: no editar `viaVoiceAssets.ts` a mano.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORPUS = path.join(ROOT, 'voice-corpus.json');
const VOICE_DIR = path.join(ROOT, 'assets', 'voice');
const MAP = path.join(ROOT, 'src', 'Voice', 'viaVoiceAssets.ts');

const HEADER = `/* -------------------------------------------------------------------------- */
/*  ARCHIVO GENERADO por \`node scripts/build-voice-asset-map.js\` — NO EDITAR.   */
/*                                                                             */
/*  Mapa estático id→módulo de asset de audio. Los \`require()\` son LITERALES    */
/*  (Metro no admite requires dinámicos), uno por locución con fichero real en  */
/*  \`assets/voice/\`. Se reescribe entero en cada corrida del pipeline; solo     */
/*  entran ids cuyo asset \`.m4a\` existe. Mientras esté vacío, \`viaVoice.speak\`  */
/*  cae siempre a la voz del sistema (sin regresión).                           */
/* -------------------------------------------------------------------------- */
`;

function main() {
  if (!fs.existsSync(CORPUS)) {
    console.error(`✗ Falta ${path.relative(ROOT, CORPUS)} — ejecuta antes: node scripts/export-voice-corpus.js`);
    process.exit(1);
  }
  const { corpus } = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
  const present = [];
  for (const entry of corpus) {
    if (fs.existsSync(path.join(VOICE_DIR, `${entry.id}.m4a`))) present.push(entry.id);
  }
  present.sort();

  const version = present.length
    ? `built-${present.length}-${crypto.createHash('sha1').update(present.join('|')).digest('hex').slice(0, 8)}`
    : 'unbuilt';

  const lines = present.map(
    id => `  ${JSON.stringify(id)}: require('../../assets/voice/${id}.m4a'),`,
  );
  const body = `${HEADER}
/** Versión del paquete de assets (nº de locuciones + hash de sus ids). */
export const VOICE_ASSETS_VERSION = ${JSON.stringify(version)};

/** id de locución → módulo del asset (\`require(...)\`). Poblado por el pipeline. */
export const VOICE_ASSETS: Record<string, number> = {${
    lines.length ? `\n${lines.join('\n')}\n` : ''
  }};
`;
  fs.writeFileSync(MAP, body);
  console.log(`✓ ${path.relative(ROOT, MAP)} — ${present.length} assets (${version})`);
}

main();
