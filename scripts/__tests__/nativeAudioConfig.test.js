/* -------------------------------------------------------------------------- */
/*  Configuración NATIVA de audio y reconocimiento de voz (A1).                */
/*                                                                            */
/*  Estas claves no las cubre ningún test de la app, y es justo donde se       */
/*  rompió: el código TypeScript compila, pasa el typecheck y arranca sin una  */
/*  queja mientras la funcionalidad está muerta en el dispositivo. Los dos     */
/*  fallos que este fichero vigila NO producen ningún error visible en JS:     */
/*                                                                            */
/*   · iOS sin `NSSpeechRecognitionUsageDescription` → el sistema TERMINA el   */
/*     proceso (SIGABRT) al pedir autorización a `SFSpeechRecognizer`. No es   */
/*     un permiso denegado que se pueda capturar con try/catch.                */
/*   · Android con targetSdk ≥ 30 sin `<queries>` → `SpeechRecognizer` no      */
/*     puede enlazar con el servicio y el módulo queda en «modo limitado»      */
/*     para siempre, aunque el reconocedor esté instalado.                     */
/*                                                                            */
/*  Van en `.js` y fuera de `src/` por la misma razón que                      */
/*  `prosodyPersistence.test.js`: el tsconfig de la app no trae los tipos de   */
/*  Node y un test en TypeScript que use `fs` rompe `npm run tsc`.             */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('iOS · Info.plist', () => {
  const plist = read('ios-native/VIAPlus/Info.plist');

  /** Valor de una clave `<key>K</key><string>V</string>` del plist. */
  const stringValue = key => {
    const m = plist.match(
      new RegExp(`<key>${key}</key>\\s*<string>([\\s\\S]*?)</string>`),
    );
    return m ? m[1] : null;
  };

  it('declara el uso del micrófono', () => {
    expect(stringValue('NSMicrophoneUsageDescription')).toBeTruthy();
  });

  /* REGRESIÓN — sin esta clave la app TERMINA al pedir autorización de
   * reconocimiento. El módulo T.A.R. la pide. */
  it('declara el uso del reconocimiento de voz', () => {
    const value = stringValue('NSSpeechRecognitionUsageDescription');
    expect(value).toBeTruthy();
    expect(value.trim().length).toBeGreaterThan(20); // App Store rechaza textos vacíos
  });

  /* La descripción del micrófono es una PROMESA al usuario, y durante un
   * tiempo prometió algo falso: decía que las grabaciones se procesan en el
   * dispositivo mientras el reconocedor del sistema podía enviarlas a un
   * servidor. Que no vuelva a afirmarse lo que el código no garantiza. */
  it('la promesa del micrófono es coherente con lo que hace el código', () => {
    const mic = stringValue('NSMicrophoneUsageDescription');
    expect(mic).toMatch(/dispositivo/i);
    expect(mic).not.toMatch(/grabaciones se procesan en el dispositivo/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Puerta Zero-PHI del reconocimiento (A2).                                   */
/*                                                                            */
/*  La lógica de decisión se prueba exhaustivamente en                         */
/*  `articulationRecognition.test.ts`. Lo que se vigila AQUÍ son las dos       */
/*  regresiones de cableado que reabrirían la fuga sin romper ninguna prueba   */
/*  de comportamiento: volver a abrir la puerta por el mero hecho de que la    */
/*  librería exista, y reintentar en otra lengua tras un fallo.                */
/* -------------------------------------------------------------------------- */
describe('T.A.R. · puerta de reconocimiento en el dispositivo', () => {
  const audio = read('src/Screens/Articulation/articulationAudio.ts');

  it('la decisión pasa por la puerta, no por «existe la librería»', () => {
    expect(audio).toContain('probeRecognitionCaps');
    expect(audio).toContain('resolveRecognitionMode');
  });

  /* REGRESIÓN — el reconocimiento se activaba en cuanto se resolvía el módulo,
   * y el reconocedor del sistema es de SERVIDOR por defecto: «hay librería»
   * acababa significando «la voz del niño viaja a Apple o a Google». */
  it('no se activa el reconocimiento al detectar la librería', () => {
    const init = audio.slice(audio.indexOf('// 2) Reconocimiento de voz'));
    const upToHandlers = init.slice(0, init.indexOf('onSpeechPartialResults'));
    expect(upToHandlers).not.toContain('setRecognitionAvailable(true)');
    expect(upToHandlers).not.toContain('recognitionRef.current = true');
  });

  /* REGRESIÓN — el reintento en la lengua base. La garantía de modo local se
   * confirma PARA UN LOCALE CONCRETO: arrancar con otro sale del alcance de lo
   * comprobado y puede acabar reconociendo por red. */
  it('no reintenta el arranque con otra lengua', () => {
    const start = audio.slice(
      audio.indexOf('const startRecognition'),
      audio.indexOf('const stopRecognition'),
    );
    const starts = start.match(/voiceRef\.current\?\.start\?\.\(/g) || [];
    expect(starts).toHaveLength(1);
    expect(start).not.toContain('start?.(RECOGNITION_FALLBACK)');
  });

  it('el módulo de decisión no admite un modo de servidor', () => {
    const gate = read('src/Screens/Articulation/articulationRecognition.ts');
    expect(gate).toContain("export type RecognitionMode = 'on-device' | 'unavailable'");
    // Se miran solo las líneas de CÓDIGO: el módulo menciona «server» en los
    // comentarios, precisamente para explicar que ese modo no existe.
    const code = gate
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/'server'/);
  });
});

describe('Android · AndroidManifest', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const gradle = read('android/build.gradle');

  it('pide permiso de micrófono', () => {
    expect(manifest).toContain('android.permission.RECORD_AUDIO');
  });

  /* REGRESIÓN — visibilidad de paquetes. El bloque `<queries>` solo hace falta
   * con targetSdk ≥ 30; se comprueba que sigue haciendo falta antes de exigirlo,
   * para que el test explique POR QUÉ y no sea una constante mágica. */
  it('targetSdk exige declarar la visibilidad del reconocedor', () => {
    const target = Number((gradle.match(/targetSdkVersion\s*=\s*(\d+)/) || [])[1]);
    expect(Number.isFinite(target)).toBe(true);
    expect(target).toBeGreaterThanOrEqual(30);
  });

  it('declara <queries> para el servicio de reconocimiento de voz', () => {
    expect(manifest).toContain('<queries>');
    expect(manifest).toContain('android.speech.RecognitionService');
  });

  it('declara también la ruta por intent de reconocimiento', () => {
    // Los fabricantes reparten el servicio de forma distinta: hay dispositivos
    // que solo resuelven por la actividad RECOGNIZE_SPEECH.
    expect(manifest).toContain('android.speech.action.RECOGNIZE_SPEECH');
  });
});
