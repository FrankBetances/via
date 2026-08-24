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

  /* Los TRES ficheros que gestiona `install-expo-modules` tienen que contar la
   * misma historia. Se arreglaron de uno en uno y a meses de distancia: Gradle
   * ya empaquetaba con el CLI de Expo mientras Metro seguía con el preset de
   * React Native (21 min 46 s de build perdidos el 23/8/2026), y cuando eso se
   * arregló, `babel.config.js` se quedó atrás otro día más. */
  it('Babel parte del preset de Expo, no del de React Native', () => {
    const babel = read('babel.config.js');
    const code = babel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/['"]babel-preset-expo['"]/);
    expect(code).not.toMatch(/@react-native\/babel-preset/);
  });

  /* REGRESIÓN — `babel-preset-expo` añade `react-native-reanimated/plugin` él
   * solo cuando el paquete está instalado. Volver a listarlo aquí lo aplica dos
   * veces, que es un fallo de configuración conocido. */
  it('no duplica el plugin de reanimated, que ya pone el preset', () => {
    const babel = read('babel.config.js');
    const code = babel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('react-native-reanimated/plugin');
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

  /* REGRESIÓN — el CUELGUE del build, demostrado el 24/8/2026.
   *
   * `install-expo-modules` escribió las dos órdenes de `node` de este bloque
   * con el patrón de Groovy `[...].execute(...).text`. `.text` lee SOLO la
   * salida estándar y no drena el error estándar, así que en cuanto el hijo
   * escribe más de lo que cabe en el buffer de la tubería (64 KB en Linux) se
   * bloquea escribiendo y Gradle se bloquea leyendo: el build se queda parado
   * en la fase de CONFIGURACIÓN, sin mensaje y sin tarea a la que señalar.
   *
   * No es teoría. Ejecutado con el propio compilador de Groovy sobre el
   * ayudante real de `build.gradle`: con 300 KB por el error estándar, el
   * patrón nuevo vuelve en 55 ms y el viejo seguía bloqueado a los 8 s.
   *
   * Este test es de CADENAS a propósito: la lógica ya está comprobada
   * ejecutándola, y lo que hace falta vigilar aquí es que nadie vuelva a
   * pegar el patrón de una línea que trae la herramienta. */
  it('las órdenes de `node` del build drenan el error estándar', () => {
    expect(reactBlock).not.toMatch(/\.execute\([^)]*\)\s*\.text/);
    expect(reactBlock).toMatch(/entryFile\s*=.*nodeOutput\(/);
    expect(reactBlock).toMatch(/cliFile\s*=.*nodeOutput\(/);
  });

  it('el ayudante que las ejecuta consume las dos salidas y comprueba el código', () => {
    const helper = gradle.slice(gradle.indexOf('def nodeOutput'), gradle.indexOf('\nreact {'));
    expect(helper).toContain('consumeProcessOutput');
    expect(helper).toContain('waitForOrKill');
    expect(helper).toContain('exitValue()');
    // Y falla DICIENDO qué pasó, no en silencio (regla 4).
    expect(helper).toContain('GradleException');
    expect(helper).toContain('stderr');
  });

  it('conserva `inlineRequires`, que sostiene el arranque', () => {
    const value = inspect(
      "c.transformer.getTransformOptions(['index.js']," +
        '{dev:false,hot:false},async()=>[]).then(o=>o.transform.inlineRequires)',
    );
    expect(value).toBe(true);
  });
});
