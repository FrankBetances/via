// ============================================================================
// VIA+ · Gate de la mascota vendorizada
//
//   node scripts/check-lua-brand.js            → comprueba (gate)
//   node scripts/check-lua-brand.js --update    → reescribe el manifiesto tras
//                                                 sincronizar desde Valeria+
//
// POR QUÉ NO ES EL GATE DE VALERIA+ COPIADO
// El `check-brand-consistency.js` de Valeria+ persigue los restos de la mascota
// retirada en SUS pantallas: identificadores `ValeriaDistractorBear`, el copy
// «Oso Distractor» en cuatro variedades, los nombres de nivel. Nada de eso
// existe en VIA+, así que copiarlo tal cual daría un gate que pasa en vacío —y
// un gate que no puede fallar es peor que no tener ninguno, porque da confianza.
//
// Lo que VIA+ sí tiene que vigilar es distinto y son dos cosas:
//
//   1. QUE LA COPIA NO SE EDITE AQUÍ. El sprite es de los dos productos: si
//      alguien lo retoca en VIA+, la cara de la app y la del aparato se separan
//      versión a versión, que es exactamente lo que el formato de rejilla venía a
//      evitar. Se comprueba por hash contra el manifiesto.
//
//   2. QUE NO ENTRE MARCA DE LA MASCOTA RETIRADA. Si algún día se copia otro
//      fichero de Valeria+ y arrastra al oso, aquí se ve.
//
// Y una distinción que se hereda del gate original y hay que respetar: **«oso» es
// vocabulario terapéutico legítimo** en este repositorio (par mínimo ocho/oso,
// frases de lectura, órdenes TPR, `hartza` en euskera). El gate persigue MARCA,
// no contenido, así que solo mira identificadores y copy de marca.
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'src', 'Lua', 'vendor', 'ValeriaCatPixel.tsx');
const MANIFEST = path.join(ROOT, 'src', 'Lua', 'vendor', 'origen.json');

/** Nº de líneas de la cabecera de vendorización que VIA+ añade al original. */
const HEADER_LINES = 19;

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/** Cuerpo del fichero: lo que debe coincidir byte a byte con el de Valeria+. */
function vendoredBody() {
  const lines = fs.readFileSync(VENDOR, 'utf8').split('\n');
  return lines.slice(HEADER_LINES).join('\n');
}

const fail = [];

/* -------------------------------------------------------------------------- */
/*  1 · La copia no se edita aquí                                             */
/* -------------------------------------------------------------------------- */
if (!fs.existsSync(VENDOR)) {
  fail.push('falta src/Lua/vendor/ValeriaCatPixel.tsx (la mascota vendorizada).');
} else if (!fs.existsSync(MANIFEST)) {
  fail.push('falta src/Lua/vendor/origen.json (el manifiesto de la copia).');
} else {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const actual = sha256(vendoredBody());
  if (actual !== manifest.bodySha256) {
    fail.push(
      'el cuerpo de ValeriaCatPixel.tsx no coincide con el manifiesto: alguien lo ha\n' +
        '  editado en VIA+. El sprite es de los dos productos y su fuente es Valeria+;\n' +
        '  corrige allí y vuelve a sincronizar (ver la cabecera del fichero).',
    );
  }
  const header = fs.readFileSync(VENDOR, 'utf8').split('\n').slice(0, HEADER_LINES).join('\n');
  if (!header.includes('VENDORIZADO') || !header.includes(manifest.upstreamCommit)) {
    fail.push('la cabecera de vendorización no declara el commit de origen del manifiesto.');
  }
}

/* -------------------------------------------------------------------------- */
/*  2 · Nada de marca de la mascota retirada                                  */
/* -------------------------------------------------------------------------- */
/* Se salta `__tests__`: no son superficie de marca —nadie ve un test— y además
 * los ficheros que VIGILAN estos identificadores tienen que poder nombrarlos.
 * Sin esta exclusión, el gate se detecta a sí mismo. */
const walk = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(e => {
      if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(path.join(dir, e.name));
      return [path.join(dir, e.name)];
    })
    .filter(p => /\.tsx?$/.test(p));

/* Identificadores y copy de MARCA, nunca vocabulario. */
const BRAND_TRACES = [
  [/\bBearMark\b/, 'identificador `BearMark`'],
  [/\bValeriaDistractorBear\b/, 'identificador `ValeriaDistractorBear`'],
  [/\bDistractorBear\b/, 'identificador `DistractorBear`'],
  [/Oso\s+Distractor/i, 'copy de marca «Oso Distractor»'],
  [/Hartz\s+Distraitzailea/i, 'copy de marca «Hartz Distraitzailea»'],
  [/Oso\s+Legendario/i, 'nombre de nivel «Oso Legendario»'],
  [/\bOsezno\b/i, 'nombre de nivel «Osezno»'],
];

for (const file of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, file);
  if (/DistractorBear|BearMark/.test(path.basename(file))) {
    fail.push(`${rel}: el fichero lleva el nombre de la mascota retirada.`);
  }
  // Los comentarios cuentan: en Valeria+, una cabecera siguió describiendo al
  // oso mucho después de que la pantalla pintara la gata, y saltarse los
  // comentarios fue justo como sobrevivió.
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const [re, what] of BRAND_TRACES) {
        if (re.test(line)) fail.push(`${rel}:${i + 1}: rastro de la mascota retirada — ${what}.`);
      }
    });
}

/* -------------------------------------------------------------------------- */
/*  --update: rehace el manifiesto tras sincronizar                            */
/* -------------------------------------------------------------------------- */
if (process.argv.includes('--update')) {
  const previo = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const manifest = {
    ...previo,
    source: 'FrankBetances/Valeria · src/ValeriaCatPixel.tsx',
    bodySha256: sha256(vendoredBody()),
    syncedAt: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('· manifiesto reescrito. Revisa `upstreamCommit` a mano si cambió.');
  process.exit(0);
}

if (fail.length) {
  console.error('✗ Gate de la mascota:\n');
  for (const f of fail) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('✓ La mascota vendorizada está intacta y no hay marca de la retirada.');
