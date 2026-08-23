/* -------------------------------------------------------------------------- */
/*  El empaquetado de release (A2).                                            */
/*                                                                            */
/*  Este fichero vigila un fallo que NINGÚN test de la app puede ver: el       */
/*  bundle de JS solo se construye al compilar, así que `tsc` limpio y 656     */
/*  tests en verde conviven perfectamente con un empaquetado roto.             */
/*                                                                            */
/*  COSTE REAL (23/8/2026). `install-expo-modules` dejó en                     */
/*  `android/app/build.gradle` un `cliFile = @expo/cli` y                      */
/*  `bundleCommand = "export:embed"`, pero `metro.config.js` siguió con        */
/*  `@react-native/metro-config`. Ese comando espera la salida ESTRUCTURADA    */
/*  del serializador de Expo (`{ code, map, artifacts }`); el de React Native  */
/*  no define `customSerializer` y devuelve el bundle en crudo, así que el CLI */
/*  intentaba parsear `var __BUNDLE_START_TIME__…` como JSON:                   */
/*                                                                            */
/*    Error: Serializer did not return expected format.                        */
/*    Error: Unexpected token 'v', "var __BUND"... is not valid JSON           */
/*    > Task :app:createBundleReleaseJsAndAssets FAILED                        */
/*    BUILD FAILED in 21m 46s                                                  */
/*                                                                            */
/*  Todo el nativo había compilado ya. El build entero se perdió en el último  */
/*  paso por una incoherencia de dos líneas entre Gradle y Metro.              */
/*                                                                            */
/*  Va en `.js` y fuera de `src/` por lo mismo que `nativeAudioConfig.test.js` */
/*  y `prosodyPersistence.test.js`: usa `fs` y el tsconfig de la app no trae   */
/*  los tipos de Node.                                                         */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('empaquetado de release · Gradle y Metro tienen que estar de acuerdo', () => {
  const gradle = read('android/app/build.gradle');

  /** Bloque `react { … }` sin comentarios: Gradle trae el suyo comentado entero. */
  const reactBlock = (() => {
    const from = gradle.indexOf('\nreact {');
    const body = gradle.slice(from, gradle.indexOf('\n}', from));
    return body.replace(/^\s*\/\/.*$/gm, '');
  })();

  it('Gradle empaqueta con el CLI de Expo', () => {
    // Si esto deja de ser cierto, el test de abajo deja de aplicar: entonces
    // hay que VOLVER a `@react-native/metro-config`, no quitar la prueba.
    expect(reactBlock).toMatch(/cliFile\s*=.*@expo\/cli/);
    expect(reactBlock).toMatch(/bundleCommand\s*=\s*["']export:embed["']/);
  });

  it('Metro parte del preset de Expo, no del de React Native', () => {
    const metro = read('metro.config.js');
    const code = metro.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/require\(['"]expo\/metro-config['"]\)/);
    expect(code).not.toMatch(/require\(['"]@react-native\/metro-config['"]\)/);
  });

  /* Lo anterior son cadenas; esto es el CONTRATO. `export:embed` falla si el
   * serializador no es el de Expo, así que se comprueba sobre la config REAL,
   * y además CARGÁNDOLA COMO LA CARGA EL BUNDLER: en un `node` aparte.
   *
   * No es un rodeo por comodidad. `require('metro-config')` trae Flow sin
   * transformar y jest revienta al cargarlo, que es justo el motivo por el que
   * este fallo no lo veía ningún test: la configuración de Metro no se puede
   * inspeccionar desde dentro de jest. Un mock la haría cargable y no probaría
   * nada (regla 3). El proceso hijo es el mismo entorno que usa Gradle. */
  const inspect = expr => {
    const { execFileSync } = require('child_process');
    const out = execFileSync(
      process.execPath,
      [
        '-e',
        `const c=require(${JSON.stringify(path.join(ROOT, 'metro.config.js'))});` +
          `Promise.resolve(${expr}).then(v=>process.stdout.write(JSON.stringify(v)))`,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    return JSON.parse(out);
  };

  it('la configuración resuelta trae el serializador que `export:embed` exige', () => {
    expect(inspect('typeof c.serializer?.customSerializer')).toBe('function');
  });

  /* REGRESIÓN — los dos ajustes propios de VIA+ no se pueden perder al cambiar
   * de preset: sin `inlineRequires` el arranque evalúa las 19 pantallas y los
   * cuatro bancos de recortes; sin el atajo de `react-dom` Metro no resuelve
   * el barril de @gluestack-ui/themed y no bundlea nada. */
  it('conserva los dos ajustes propios de VIA+', () => {
    expect(inspect("c.resolver?.extraNodeModules?.['react-dom']")).toContain('empty-module');
  });

  it('conserva `inlineRequires`, que sostiene el arranque', () => {
    const value = inspect(
      "c.transformer.getTransformOptions(['index.js']," +
        '{dev:false,hot:false},async()=>[]).then(o=>o.transform.inlineRequires)',
    );
    expect(value).toBe(true);
  });
});
