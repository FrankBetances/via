/* -------------------------------------------------------------------------- */
/*  Los niveles de SDK de Android salen de React Native, no de una elección.   */
/*                                                                            */
/*  Coste real (5/9/2026). Google Play RECHAZÓ la subida a pruebas internas:   */
/*  «tu aplicación está orientada al nivel 35 de la API, pero debe orientarse, */
/*  al menos, al nivel 36». `compileSdkVersion` y `buildToolsVersion` ya       */
/*  estaban en 36 desde la migración; `targetSdkVersion` se quedó en 35 y      */
/*  nadie lo vio, porque un target desfasado NO rompe nada: compila, pasa los  */
/*  gates, genera el AAB y solo falla en la consola de Play, al final del      */
/*  todo y con el build ya hecho.                                             */
/*                                                                            */
/*  La regla que este fichero convierte en máquina es la que CLAUDE.md §1 ya   */
/*  aplica a `kotlinVersion`: «no se elige un número que suene bien: se toma   */
/*  el que trae la propia versión de React Native que el proyecto usa». RN     */
/*  0.81.5 declara compileSdk 36 / targetSdk 36 / minSdk 24 en su              */
/*  `gradle/libs.versions.toml`. Si al subir de RN esos números cambian, el    */
/*  desfase salta AQUÍ —en el gate, antes de empujar— y no en la consola de    */
/*  Play tres días después.                                                   */
/*                                                                            */
/*  Va en `.js` y fuera de `src/` por lo mismo que sus vecinos: el tsconfig    */
/*  de la app no trae los tipos de Node.                                      */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const gradle = read('android/build.gradle');

/** Valor de una clave `nombre = <numero>` del bloque `ext` de Gradle. */
const extNumber = clave => {
  const m = gradle.match(new RegExp(`^\\s*${clave}\\s*=\\s*(\\d+)`, 'm'));
  if (!m) throw new Error(`No se encuentra ${clave} en android/build.gradle`);
  return Number(m[1]);
};

/**
 * Valor de una clave del `libs.versions.toml` de React Native, que es la
 * fuente: los números no se eligen aquí, se heredan de la versión de RN.
 */
const rnVersion = clave => {
  const toml = read('node_modules/react-native/gradle/libs.versions.toml');
  const m = toml.match(new RegExp(`^${clave}\\s*=\\s*"(\\d+)"`, 'm'));
  if (!m) {
    throw new Error(
      `No se encuentra ${clave} en el libs.versions.toml de react-native. ` +
        'Si la clave cambió de nombre al subir de versión, actualiza este test ' +
        'MIRANDO el fichero — no lo desactives.',
    );
  }
  return Number(m[1]);
};

describe('android/build.gradle · los SDK los fija React Native', () => {
  it('targetSdkVersion es el de la versión de React Native instalada', () => {
    expect(extNumber('targetSdkVersion')).toBe(rnVersion('targetSdk'));
  });

  it('compileSdkVersion es el de la versión de React Native instalada', () => {
    expect(extNumber('compileSdkVersion')).toBe(rnVersion('compileSdk'));
  });

  it('minSdkVersion no baja del que exige React Native', () => {
    // Aquí sí cabe subir por encima (una API que la app necesite), nunca bajar.
    expect(extNumber('minSdkVersion')).toBeGreaterThanOrEqual(rnVersion('minSdk'));
  });
});

describe('Google Play · el listón de la consola', () => {
  /*
   * Play sube este mínimo cada año y el rechazo llega al final: con el AAB ya
   * construido, firmado y subido. El número de aquí se sube A MANO cuando Play
   * lo anuncie, y entonces el primer bloque obliga a que RN lo respalde.
   */
  const MINIMO_PLAY = 36; // exigido desde el 5/9/2026 (rechazo real de la consola)

  it('targetSdkVersion cumple el mínimo que exige Play para publicar', () => {
    expect(extNumber('targetSdkVersion')).toBeGreaterThanOrEqual(MINIMO_PLAY);
  });

  it('compileSdkVersion no se queda por debajo del target', () => {
    // Gradle falla si se compila contra un SDK menor que el que se declara.
    expect(extNumber('compileSdkVersion')).toBeGreaterThanOrEqual(
      extNumber('targetSdkVersion'),
    );
  });
});

describe('AndroidManifest · lo que Android 16 cambia con target 36', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const temas = fs
    .readdirSync(path.join(ROOT, 'android/app/src/main/res'))
    .filter(d => d.startsWith('values'))
    .flatMap(d => {
      const dir = path.join(ROOT, 'android/app/src/main/res', d);
      return fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
    })
    .join('\n');

  it('no pide el opt-out de edge-to-edge, que Android 16 ya ignora', () => {
    // Con target 36 la bandera no hace nada: una app que dependiera de ella se
    // encontraría el contenido bajo las barras del sistema, sin aviso.
    expect(manifest).not.toContain('windowOptOutEdgeToEdgeEnforcement');
    expect(temas).not.toContain('windowOptOutEdgeToEdgeEnforcement');
  });

  it('no fija orientación ni bloquea el redimensionado', () => {
    // Android 16 ignora las dos en pantallas ≥ 600 dp con target 36. Declararlas
    // daría una falsa sensación de control sobre la tableta del gabinete.
    expect(manifest).not.toContain('android:screenOrientation');
    expect(manifest).not.toContain('android:resizeableActivity');
  });

  it('la actividad absorbe los cambios de configuración sin recrearse', () => {
    const m = manifest.match(/android:configChanges="([^"]+)"/);
    expect(m).not.toBeNull();
    const cambios = m[1].split('|');
    expect(cambios).toEqual(expect.arrayContaining(['orientation', 'screenSize']));
  });
});
