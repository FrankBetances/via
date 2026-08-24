/* -------------------------------------------------------------------------- */
/*  Auditoría de dependencias NATIVAS (A3).                                    */
/*                                                                            */
/*  COSTE REAL (23/8/2026). `react-native-audio-recorder-player@3.6.7` dejó de */
/*  usarse cuando la toma del T.A.R. pasó a PCM en memoria, pero se quedó      */
/*  DECLARADA en `package.json`. El autolinking de React Native no mira quién  */
/*  importa una librería: mira quién la declara. Con React Native 0.81 su      */
/*  Kotlin dejó de compilar y el build de release cayó a los 15 min 51 s en    */
/*  `:react-native-audio-recorder-player:compileReleaseKotlin`. Una librería   */
/*  que la app no usa dejó a Frank sin APK.                                    */
/*                                                                            */
/*  Y no fue un descuido: durante la migración de agosto de 2026 la dependen-  */
/*  cia se VIO en el `package.json` y se dejó pasar para «no ampliar el        */
/*  alcance». Este fichero convierte esa auditoría en algo que no depende de   */
/*  que alguien se acuerde: si aparece una dependencia con código nativo de    */
/*  Android que `src/` no importa, el test falla y hay que justificarla aquí   */
/*  o quitarla.                                                                */
/*                                                                            */
/*  Ningún test de comportamiento puede ver esto: la librería muerta no rompe  */
/*  ni el typecheck ni una suite, solo el build nativo o el arranque del APK.  */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/* --------------------------------------------------------------------------
 * Dependencias con código nativo de Android que NADIE importa desde `src/`,
 * con el motivo por el que aun así se quedan. Sin motivo escrito no hay
 * entrada: esa es toda la gracia de la lista.
 * -------------------------------------------------------------------------- */
const SIN_IMPORTAR_JUSTIFICADAS = {
  /* Requisito declarado de @react-navigation/native-stack: la navegación
   * nativa no funciona sin él aunque la app nunca escriba su nombre. */
  'react-native-screens': 'peer de @react-navigation/native-stack',
  /* Peer declarado de react-native-nitro-sqlite (que sí se usa: es el driver
   * de TypeORM). Ver package.json de nitro-sqlite: peerDependencies. */
  'react-native-nitro-modules': 'peer de react-native-nitro-sqlite',
  /* El paquete `expo` es el HOST de los módulos de Expo: `expo-audio`,
   * `expo-speech` y `expo-speech-recognition` no se autolinkean ni resuelven
   * sin él, y `android/app/build.gradle` lo usa además para resolver el
   * entryFile (`expo/scripts/resolveAppEntry`). La app no lo importa por su
   * nombre y no debe hacerlo. */
  expo: 'host de los módulos de Expo (expo-audio, expo-speech, expo-speech-recognition)',
  /* PENDIENTE DE DECISIÓN — no está justificada, está ANOTADA.
   * `react-native-ble-plx` solo aparece en COMENTARIOS de src/ (`installLua.ts`,
   * `pulseOximeter.ts`): los dos adaptadores reciben el `BleManager` inyectado
   * desde fuera y hoy no lo construye nadie. Es decir: hoy es exactamente la
   * misma figura que `react-native-audio-recorder-player` —autolinkeada,
   * compilada en cada build, arrastrando rxandroidble y toda la cirugía de
   * permisos del manifiesto— sostenida solo por una integración que aún no
   * está enchufada. Se queda porque quitarla es una decisión de PRODUCTO
   * (Lúa y el pulsioxímetro de disfagia), no de limpieza, y esa la toma Frank.
   * Si se decide que no entra en esta versión, esta línea se borra con ella. */
  'react-native-ble-plx': 'Lúa + pulsioxímetro de disfagia: integración escrita, manager sin instanciar (decisión pendiente)',
};

/** Ficheros de la app donde puede haber un import de verdad. */
const sourceFiles = (() => {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
        walk(full);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  out.push(path.join(ROOT, 'index.js'));
  return out;
})();

/* Los comentarios NO cuentan como uso. `react-native-ble-plx` aparece seis
 * veces en `src/` y las seis son ejemplos dentro de un bloque `/* … *​/`: si el
 * escáner no los quitara, una librería muerta pasaría por viva. */
const stripComments = code =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[\t ]*\/\/.*$/gm, '');

const sources = sourceFiles.map(f => stripComments(fs.readFileSync(f, 'utf8')));

/** ¿La app importa o requiere el paquete (o un subcamino suyo) de verdad? */
const isImported = dep => {
  const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:from|require\\()\\s*['"]${escaped}(?:/[^'"]*)?['"]`);
  return sources.some(code => re.test(code));
};

/** Dependencias que traen código nativo de Android (autolinkeadas). */
const nativeDeps = Object.keys(pkg.dependencies || {}).filter(
  dep =>
    fs.existsSync(path.join(ROOT, 'node_modules', dep, 'android', 'build.gradle')) ||
    fs.existsSync(path.join(ROOT, 'node_modules', dep, 'expo-module.config.json')),
);

describe('dependencias nativas · lo que se compila tiene que usarse', () => {
  it('encuentra las dependencias nativas del proyecto', () => {
    // Si esto se queda en cero es que `node_modules` no está instalado y el
    // resto del fichero no estaría probando nada.
    expect(nativeDeps.length).toBeGreaterThan(5);
  });

  it('ninguna dependencia nativa está declarada sin usarse ni justificarse', () => {
    const huerfanas = nativeDeps.filter(dep => !isImported(dep) && !(dep in SIN_IMPORTAR_JUSTIFICADAS));
    expect(huerfanas).toEqual([]);
  });

  /* REGRESIÓN — la lista de justificaciones no puede usarse para tapar una
   * librería que sí se importa (quedaría marcada como muerta sin serlo) ni
   * quedarse con entradas de paquetes ya desinstalados. */
  it('la lista de justificadas no tiene entradas obsoletas', () => {
    const obsoletas = Object.keys(SIN_IMPORTAR_JUSTIFICADAS).filter(
      dep => !nativeDeps.includes(dep) || isImported(dep),
    );
    expect(obsoletas).toEqual([]);
  });

  /* REGRESIÓN — `@sentry/react-native@8.16.0` estuvo declarada sin que ni un
   * solo fichero de `src/` la importara: telemetría nativa de mediados de 2024
   * compilándose dentro de un APK de React Native 0.81 con la arquitectura
   * nueva, sin que nada de la app la llamara jamás. Es la misma figura que
   * `react-native-audio-recorder-player`, y se quitó en el mismo sitio en que
   * se descubrió. Si vuelve a hacer falta telemetría, entra con su `init()` y
   * con una versión que respalde la React Native del proyecto. */
  it('no vuelve a entrar telemetría nativa que nadie inicializa', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps['@sentry/react-native']).toBeUndefined();
  });
});
