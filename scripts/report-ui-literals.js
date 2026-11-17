// INFORME (no es un gate): literales de interfaz que `check-ui-strings.js` no ve.
//
// Paquete E1 de `docs/PLAN-MEJORA-APP.md` (hallazgo H6). El gate existente mira
// el texto JSX y una lista de props visibles de los `.tsx`. Se le escapan dos
// cosas, y este script las LISTA para tener el recuento real antes de decidir
// nada:
//
//   (a) argumentos de texto literal de `show*Toast(...)` y de `Alert.alert(...)`,
//       en `.tsx` Y en `.ts`.
//   (b) literales en ficheros `.ts` que alimentan pantallas: valores de
//       propiedades de objeto cuyo nombre es de texto visible (VISIBLE_KEYS).
//
// Es un informe: SALE SIEMPRE con código 0 y no está en la lista de gates ni en
// el CI. No toca ni sustituye a `scripts/check-ui-strings.js`; la lógica de
// «qué es una frase» (isPhrase, BRAND) y de «qué es un literal» (literalOf) está
// COPIADA de él a propósito, para no modificar el gate. Si cambian allí, aquí
// hay que seguirlos a mano.
//
// Respeta la exención del gate: un comentario `// i18n-exempt: motivo` en la
// línea del literal o en la anterior. El motivo es obligatorio.
//
// Uso:
//     node scripts/report-ui-literals.js              # informe legible
//     node scripts/report-ui-literals.js --json       # los hallazgos en JSON
//     node scripts/report-ui-literals.js --src <dir>  # otra carpeta (tests)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');

// ---- copiado de scripts/check-ui-strings.js (ver cabecera) -----------------
const BRAND = new Set([
  'VIA', 'VIA+', 'Lúa', 'beta',
  'Dr. Frank Alberto Betances Reinoso', 'Dr. Frank Betances',
  'ACOPROS', 'Earlify Health', 'Quisqueya Habla (FONDOCYT)', 'Quisqueya Habla',
  'MDR 2017/745', 'Piper · rhasspy/piper-voices', 'eSpeak NG',
  'Proxecto Nós', 'AhoTTS', 'HiTZ', 'Praat',
]);
const isPhrase = (s) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/.test(s) && !BRAND.has(s.trim());

const literalOf = (node) => {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    const chunks = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
    return chunks.some(isPhrase) ? chunks.join(' … ') : null;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [literalOf(node.left), literalOf(node.right)].filter(Boolean).join(' … ') || null;
  }
  if (ts.isParenthesizedExpression(node)) return literalOf(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [literalOf(node.whenTrue), literalOf(node.whenFalse)].filter(Boolean).join(' … ') || null;
  }
  return null;
};
// ----------------------------------------------------------------------------

// Criterio (b), objetivo y escrito aquí para que se pueda discutir:
//   una PROPIEDAD de objeto en un `.ts` (no .tsx) es texto visible si
//     1. su nombre está en VISIBLE_KEYS,
//     2. su valor es un literal (cadena, plantilla, concatenación o ternario
//        de literales: `literalOf` no es null),
//     3. el literal es «frase» (≥ 3 letras seguidas y no es una marca), y
//     4. empieza por mayúscula O contiene un espacio.
//   Con (4) se descartan casi todos los identificadores (`title: 'audio'`,
//   `label: 'f0'`) sin perder las frases. No descarta un título de una palabra
//   en minúscula, ni detecta texto que llegue por `return 'Texto'`, por un
//   array de cadenas (`SIGNS = ['Facies adenoidea']`) o por una variable: eso
//   queda FUERA del informe y se dice en el informe escrito.
const VISIBLE_KEYS = new Set([
  'title', 'label', 'headline', 'text', 'message', 'instruction', 'description',
  'subtitle', 'metric', 'reason', 'sub', 'hint', 'caption', 'recommendation', 'summary',
]);

const looksVisible = (s) => {
  const t = s.trim();
  return isPhrase(t) && (/^\p{Lu}/u.test(t) || /\s/.test(t));
};

const isToastName = (name) => /^show[A-Za-z]*Toast$/.test(name);

/**
 * Hallazgos de UN fichero. `kind`: 'toast' | 'alert' | 'prop'.
 * `isTsx` decide el modo de parseo y si se aplica el criterio (b) (solo `.ts`).
 */
function scanText(text, rel, isTsx) {
  const lines = text.split('\n');
  const sf = ts.createSourceFile(
    rel, text, ts.ScriptTarget.Latest, true, isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found = [];
  let exempted = 0;

  const exempt = (line) => [lines[line - 1], lines[line - 2]]
    .some((l) => l && /\/\/\s*i18n-exempt:\s*\S/.test(l));

  const add = (node, kind, detail, sample, owner) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    if (exempt(line)) { exempted++; return; }
    // `call`: línea de la LLAMADA, para contar llamadas (un toast lleva título
    // y mensaje: dos literales, una llamada).
    const call = owner ? sf.getLineAndCharacterOfPosition(owner.getStart(sf)).line + 1 : line;
    found.push({
      file: rel, line, call, kind, detail,
      sample: sample.replace(/\s+/g, ' ').trim().slice(0, 70),
    });
  };

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      let kind = null;
      let detail = null;
      if (ts.isIdentifier(callee) && isToastName(callee.text)) {
        kind = 'toast'; detail = callee.text;
      } else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'alert'
          && ts.isIdentifier(callee.expression) && callee.expression.text === 'Alert') {
        kind = 'alert'; detail = 'Alert.alert';
      }
      if (kind) {
        for (const arg of node.arguments) {
          const value = literalOf(arg);
          if (value && isPhrase(value)) add(arg, kind, detail, value, node);
        }
      }
    }

    if (!isTsx && ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      if (name && VISIBLE_KEYS.has(name)) {
        const value = literalOf(node.initializer);
        if (value && looksVisible(value)) add(node.initializer, 'prop', name, value);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { found, exempted };
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

// El catálogo es el sitio donde el texto DEBE estar; los tests y los `.d.ts`
// no llegan a pantalla.
const skip = (rel) => rel.includes('/__tests__/') || rel.endsWith('.d.ts') || rel.startsWith('src/I18n/');

function scanTree(srcDir, rootDir) {
  const all = [];
  let exempted = 0;
  let files = 0;
  for (const file of walk(srcDir)) {
    const isTsx = file.endsWith('.tsx');
    if (!isTsx && !file.endsWith('.ts')) continue;
    const rel = path.relative(rootDir, file).split(path.sep).join('/');
    if (skip(rel)) continue;
    files++;
    const r = scanText(fs.readFileSync(file, 'utf8'), rel, isTsx);
    all.push(...r.found);
    exempted += r.exempted;
  }
  return { all, exempted, files };
}

function main(argv) {
  const srcIdx = argv.indexOf('--src');
  const srcDir = srcIdx >= 0 ? path.resolve(argv[srcIdx + 1]) : path.join(ROOT, 'src');
  const rootDir = srcIdx >= 0 ? path.dirname(srcDir) : ROOT;
  const { all, exempted, files } = scanTree(srcDir, rootDir);

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ files, exempted, findings: all }, null, 2));
    return;
  }

  const byKind = (k) => all.filter((f) => f.kind === k);
  const toasts = byKind('toast');
  const alerts = byKind('alert');
  const props = byKind('prop');

  const countBy = (list) => {
    const m = new Map();
    for (const f of list) m.set(f.file, (m.get(f.file) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };

  console.log('INFORME de literales de interfaz fuera del catálogo (no es un gate).');
  console.log(`Ficheros analizados: ${files} · exenciones respetadas: ${exempted}\n`);
  const calls = (list) => new Set(list.map((f) => `${f.file}:${f.call}`)).size;
  console.log(`(a) toasts con texto literal ........ ${toasts.length} literales en ${calls(toasts)} llamadas`);
  console.log(`(a) Alert.alert con texto literal ... ${alerts.length} literales en ${calls(alerts)} llamadas`);
  console.log(`(b) propiedades visibles en .ts ..... ${props.length}`);
  console.log(`TOTAL de literales .................. ${all.length}\n`);

  const section = (title, list) => {
    console.log(`── ${title} (${list.length}) ──`);
    for (const [file, n] of countBy(list)) console.log(`  ${String(n).padStart(3)}  ${file}`);
    console.log('');
    for (const f of list.slice().sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      console.log(`  ${f.file}:${f.line}: ${f.detail} — «${f.sample}»`);
    }
    console.log('');
  };
  section('(a) show*Toast', toasts);
  section('(a) Alert.alert', alerts);
  section('(b) propiedades de texto en .ts', props);
}

module.exports = { scanText, scanTree, VISIBLE_KEYS };

if (require.main === module) {
  main(process.argv.slice(2));
  // Un informe no falla nunca: el código de salida es siempre 0.
  process.exitCode = 0;
}
