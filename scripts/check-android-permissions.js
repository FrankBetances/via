#!/usr/bin/env node
/**
 * Puerta de permisos del manifiesto FUSIONADO de Android.
 *
 *   node scripts/check-android-permissions.js [ruta/AndroidManifest.xml]
 *
 * Sin argumento busca el manifiesto de release que deja AGP en
 * `android/app/build/intermediates/…/AndroidManifest.xml`, es decir el que
 * acaba dentro del APK y del AAB, no el de `src/main`.
 *
 * ¿Por qué existe? Porque Play Console rechaza el bundle si un mismo permiso
 * aparece declarado dos veces con `maxSdkVersion` distinto, y esa duplicación
 * no la produce nuestro manifiesto: la produce el MERGE con los manifiestos de
 * las dependencias. Nadie la ve hasta que la consola contesta «Declaraciones
 * duplicadas del elemento <uses-permission>», con el bundle ya subido, el
 * versionCode quemado y otra vuelta de CI por delante. Ya ha pasado dos veces.
 *
 * El criterio es el mismo que aplica Play: un permiso, una declaración. Y
 * cuenta como declaración tanto <uses-permission> como <uses-permission-sdk-23>
 * — son elementos distintos para el manifest merger (por eso una directiva
 * `tools:node="replace"` sobre uno no toca el otro), pero para la tienda ambos
 * declaran el mismo permiso.
 *
 * De paso imprime la lista final de permisos del artefacto. Es la respuesta
 * literal a «¿qué permisos pide la app?» del formulario de seguridad de los
 * datos de Play, y sirve para detectar permisos que se cuelan por una
 * dependencia sin que nadie los haya decidido.
 */

const fs = require('fs');
const path = require('path');

const ELEMENTS = ['uses-permission', 'uses-permission-sdk-23'];

/** Localiza el manifiesto fusionado de release que genera AGP. */
function findMergedManifest() {
  const root = path.resolve(__dirname, '..', 'android', 'app', 'build', 'intermediates');
  if (!fs.existsSync(root)) return null;

  const found = [];
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.name === 'AndroidManifest.xml' && /(^|[/\\])release([/\\]|$)/i.test(dir)) {
        found.push(full);
      }
    }
  };
  // `merged_manifests` es el nombre en AGP 8.x; se acepta cualquier carpeta de
  // intermediates que contenga un manifiesto de release por si cambia.
  walk(root, 0);

  const preferred = found.find(f => f.includes('merged_manifest'));
  return preferred || found[0] || null;
}

/** Extrae {elemento, permiso, maxSdkVersion} de cada declaración del manifiesto. */
function parseDeclarations(xml) {
  const declarations = [];
  for (const element of ELEMENTS) {
    // El manifiesto fusionado lo escribe AGP: atributos simples, sin CDATA ni
    // namespaces exóticos. Una expresión regular tolerante basta y evita meter
    // un parser de XML como dependencia del build.
    //
    // `(?![-\w])` en lugar de `\b`: el guion no es carácter de palabra, así que
    // `<uses-permission\b` también casaría con `<uses-permission-sdk-23` y cada
    // declaración sdk-23 se contaría dos veces (duplicado fantasma).
    const re = new RegExp(`<${element}(?![-\\w])([^>]*)>`, 'g');
    let match;
    while ((match = re.exec(xml)) !== null) {
      const attrs = match[1];
      const name = /android:name\s*=\s*"([^"]+)"/.exec(attrs);
      if (!name) continue;
      const maxSdk = /android:maxSdkVersion\s*=\s*"([^"]+)"/.exec(attrs);
      declarations.push({
        element,
        permission: name[1],
        maxSdkVersion: maxSdk ? maxSdk[1] : null,
      });
    }
  }
  return declarations;
}

function main() {
  const explicit = process.argv[2];
  const manifest = explicit ? path.resolve(explicit) : findMergedManifest();

  if (!manifest || !fs.existsSync(manifest)) {
    console.error(
      'check-android-permissions: no encuentro el manifiesto fusionado de release.\n' +
        'Compila antes (`./gradlew bundleRelease`) o pasa la ruta como argumento.',
    );
    process.exit(1);
  }

  const declarations = parseDeclarations(fs.readFileSync(manifest, 'utf8'));
  if (declarations.length === 0) {
    console.error(`check-android-permissions: ${manifest} no declara ningún permiso. ¿Es el manifiesto correcto?`);
    process.exit(1);
  }

  const byPermission = new Map();
  for (const d of declarations) {
    if (!byPermission.has(d.permission)) byPermission.set(d.permission, []);
    byPermission.get(d.permission).push(d);
  }

  const duplicated = [...byPermission.entries()].filter(([, list]) => list.length > 1);

  console.log(`Permisos del manifiesto fusionado (${path.relative(process.cwd(), manifest)}):`);
  for (const permission of [...byPermission.keys()].sort()) {
    const list = byPermission.get(permission);
    const detail = list
      .map(d => `${d.element}${d.maxSdkVersion ? ` maxSdkVersion=${d.maxSdkVersion}` : ''}`)
      .join(' + ');
    console.log(`  ${list.length > 1 ? '✗' : '·'} ${permission.replace('android.permission.', '')} — ${detail}`);
  }

  if (duplicated.length > 0) {
    console.error('\nDeclaraciones duplicadas. Play Console rechazará el bundle:\n');
    for (const [permission, list] of duplicated) {
      console.error(`  ${permission}`);
      for (const d of list) {
        console.error(`    <${d.element}${d.maxSdkVersion ? ` maxSdkVersion="${d.maxSdkVersion}"` : ''}>`);
      }
    }
    console.error(
      '\nSe arregla en android/app/src/main/AndroidManifest.xml declarando el permiso\n' +
        'con `tools:node="replace"` (para que gane la declaración de la app) y, si la\n' +
        'duplicación viene de un <uses-permission-sdk-23> de una dependencia, añadiendo\n' +
        'además ese mismo elemento con `tools:node="remove"`.',
    );
    process.exit(1);
  }

  console.log('\nSin duplicados: un permiso, una declaración.');
}

main();
