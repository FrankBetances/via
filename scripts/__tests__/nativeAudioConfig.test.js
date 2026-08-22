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

  /* La puerta Zero-PHI vive ahora en `speechRecognitionBridge`, no en un parche
   * sobre el Java y el Objective-C de una librería deprecada.
   * `expo-speech-recognition` trae de serie lo que aquel parche añadía a mano.
   * Lo que se vigila es la GARANTÍA, no el mecanismo: si alguien la quita, el
   * T.A.R. empezaría a mandar la voz de un menor a la nube sin que se note. */
  it('el arranque EXIGE reconocimiento en el dispositivo', () => {
    const bridge = read('src/Screens/Articulation/speechRecognitionBridge.ts');
    // Declarado al motor…
    expect(bridge).toContain('requiresOnDeviceRecognition: true');
    // …y comprobado ANTES de arrancar, no solo pedido como preferencia.
    expect(bridge).toContain('if (!supportsOnDeviceRecognition())');
  });

  /* REGRESIÓN — «el micrófono se activa y no pasa nada» en el T.A.R.
   *
   * El parche anterior, cuando no podía garantizar el modo local, hacía
   * `return` a secas dentro de `startListening`: ni `onSpeechError` ni rechazo
   * de promesa. El JS se quedaba esperando un resultado que no llegaba nunca y
   * la pantalla parecía estar escuchando. En cualquier emulador de Android ese
   * era el caso NORMAL, porque `isOnDeviceRecognitionAvailable()` exige API 33
   * y el modelo de la lengua descargado.
   *
   * La puerta sigue cerrada; lo que no puede volver a pasar es que se cierre
   * en silencio. */
  it('cuando la puerta se cierra, LANZA en vez de volver en silencio', () => {
    const bridge = read('src/Screens/Articulation/speechRecognitionBridge.ts');
    const gate = bridge.slice(bridge.indexOf('if (!supportsOnDeviceRecognition())'));
    const body = gate.slice(0, gate.indexOf('}'));
    expect(body).toContain('throw new Error');
    expect(body).not.toMatch(/^\s*return;\s*$/m);
  });

  /* La librería deprecada y su parche no pueden volver a colarse: npm marca
   * `@react-native-voice/voice` como obsoleta recomendando exactamente el
   * paquete que ahora se usa, y `react-native-tts` traía el bug de `voices()`
   * que dejaba la lista de voces vacía en silencio. */
  it('no se ha reintroducido ninguna de las dos librerías retiradas', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps['@react-native-voice/voice']).toBeUndefined();
    expect(deps['react-native-tts']).toBeUndefined();
    expect(deps['expo-speech']).toBeTruthy();
    expect(deps['expo-speech-recognition']).toBeTruthy();
    expect(deps['expo-audio']).toBeTruthy();
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

/* -------------------------------------------------------------------------- */
/*  Zero-PHI de la toma del T.A.R. (A3).                                       */
/* -------------------------------------------------------------------------- */
describe('T.A.R. · la toma no toca el disco', () => {
  const audio = read('src/Screens/Articulation/articulationAudio.ts');

  /* REGRESIÓN — `react-native-audio-recorder-player` escribía un `.wav` que
   * nadie borraba: la voz del paciente quedaba en el almacenamiento de la app
   * indefinidamente. Ahora se captura PCM en memoria sobre el micrófono
   * compartido, así que no hay fichero que limpiar. */
  it('no usa el grabador a fichero', () => {
    // Solo CÓDIGO: los comentarios nombran la librería retirada para explicar
    // por qué se retiró.
    const code = audio.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('react-native-audio-recorder-player');
    expect(code).not.toContain('startRecorder');
    expect(code).not.toContain('audioUri');
  });

  it('captura sobre el micrófono compartido, en memoria', () => {
    expect(audio).toContain('acquireRecorder');
    expect(audio).toContain('createDecimator3');
    expect(audio).toContain('takeRef');
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

  /* REGRESIÓN — «el T.A.R. no suena».
   *
   * El mismo filtrado de visibilidad, el otro servicio. El sintetizador de voz
   * es un SERVICIO ENLAZADO (`android.intent.action.TTS_SERVICE`): sin esta
   * declaración, `TextToSpeech` no enlaza con NINGÚN motor —la inicialización
   * devuelve ERROR, `voices()` sale vacío y `speak()` no emite— y no hay
   * ninguna señal en JS: simplemente no suena nada.
   *
   * Se declaró el `<queries>` del reconocedor y se olvidó el del sintetizador,
   * que es de lo que dependen el modelo hablado del T.A.R. y la consigna del
   * módulo de prosodia. La audiometría verbal se salvó por reproducir recortes
   * empaquetados (`preferTts: false`), y esa asimetría fue justo lo que hizo
   * que el fallo pareciera «del T.A.R.» y no de la app.
   *
   * `react-native-tts` no lo declara en su propio manifiesto (está vacío), así
   * que tiene que declararlo la app. */
  it('declara <queries> para el servicio de SÍNTESIS de voz', () => {
    expect(manifest).toContain('android.intent.action.TTS_SERVICE');
  });

  it('la declaración del sintetizador está DENTRO del bloque <queries>', () => {
    const queries = (manifest.match(/<queries>([\s\S]*?)<\/queries>/) || [])[1] ?? '';
    expect(queries).toContain('android.intent.action.TTS_SERVICE');
  });
});
