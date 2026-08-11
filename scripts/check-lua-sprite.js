// Gate: la mascota Lúa de VIA+ no puede divergir de la de Valeria+.
//
// Lúa es de los dos productos y su fuente vive en FrankBetances/Valeria
// (src/ValeriaCatPixel.tsx). Aquí hay una copia, y una copia sin comprobación
// se desfasa: es literalmente lo que ya pasó al intentar traerla tres veces.
//
// Compara el DIBUJO, no el fichero. Extrae las dos rejillas y la paleta y las
// hashea, así que los comentarios, las rutas y el nombre del componente pueden
// diferir entre repositorios —y difieren— sin que el gate salte. Lo que no
// puede diferir es un solo píxel.
//
// SI ESTE GATE FALLA:
//   · ¿cambiaste el dibujo aquí? No se hace aquí. Se hace en Valeria+.
//   · ¿cambió en Valeria+? Vuelve a copiar el fichero entero a
//     src/Components/Mascot/LuaPixel.tsx y actualiza EXPECTED con el hash que
//     imprime este mismo script en Valeria+.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SPRITE = path.join(__dirname, '..', 'src', 'Components', 'Mascot', 'LuaPixel.tsx');

// Hash del dibujo en FrankBetances/Valeria @ ValeriaCatPixel.tsx (10/8/2026).
const EXPECTED = '13f146b8df78ee7d397a050d7d69e347e159f3f433e1d8cb48570b919d29bc92';

if (!fs.existsSync(SPRITE)) {
  console.error(`\n✖ Falta ${path.relative(path.join(__dirname, '..'), SPRITE)}.`);
  console.error('  La mascota se copia de FrankBetances/Valeria → src/ValeriaCatPixel.tsx\n');
  process.exit(1);
}

const src = fs.readFileSync(SPRITE, 'utf8');
const grid = (name) => {
  const i = src.indexOf(`const ${name}: PixelMap = [`);
  if (i < 0) return null;
  const j = src.indexOf('];', i);
  return [...src.slice(i, j).matchAll(/'([.a-z]+)'/g)].map((m) => m[1]).join('|');
};
const head = grid('HEAD');
const sit = grid('SIT');
const pal = [...src
  .slice(src.indexOf('CAT_TUXEDO: CatPalette = {'), src.indexOf('};', src.indexOf('CAT_TUXEDO')))
  .matchAll(/(\w): '(#[0-9a-fA-F]+)'/g)].map((m) => m[1] + m[2].toLowerCase()).join(',');

if (!head || !sit || !pal) {
  console.error('\n✖ No encuentro las rejillas HEAD/SIT o la paleta CAT_TUXEDO.');
  console.error('  La copia está incompleta: llévate el fichero ENTERO, no un fragmento.\n');
  process.exit(1);
}

const got = crypto.createHash('sha256').update(`${head}#${sit}#${pal}`).digest('hex');

if (got !== EXPECTED) {
  console.error('\n✖ El dibujo de Lúa no coincide con el de Valeria+.');
  console.error(`    esperado ${EXPECTED}`);
  console.error(`    aquí     ${got}`);
  console.error('\n  La mascota NO se edita en VIA+. Se edita en FrankBetances/Valeria,');
  console.error('  se corre allí `npm run build:brand`, y se vuelve a copiar el fichero');
  console.error('  entero a src/Components/Mascot/LuaPixel.tsx.\n');
  process.exit(1);
}

console.log(`Lúa coincide con Valeria+ · ${head.split('|')[0].length}×${head.split('|').length} cabeza · ${got.slice(0, 12)}…`);
