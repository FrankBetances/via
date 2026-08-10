/* -------------------------------------------------------------------------- */
/*  Guardián: todo el que abre el micrófono pasa por la sesión de grabación.     */
/*                                                                             */
/*  El permiso de ruido de Lúa cuelga de UN aviso —las transiciones de           */
/*  `acquireRecordingSession()`— y de ahí sale su mejor propiedad: el quinto      */
/*  módulo con micrófono que se escriba queda protegido sin que su autor sepa que */
/*  Lúa existe. Esa propiedad se apoya en un supuesto que el código puede         */
/*  romper en cualquier commit: que ese punto sea DE VERDAD el único por el que   */
/*  se abre el micrófono.                                                        */
/*                                                                             */
/*  Este test lo comprueba leyendo el árbol de fuentes en vez de confiar en la    */
/*  memoria de nadie. Falla cuando aparece un consumidor de micrófono nuevo que   */
/*  no reserva la sesión — que es exactamente el momento en que hace falta que    */
/*  alguien avise, y el momento en que nadie se acuerda de mirar este documento.  */
/*                                                                             */
/*  Ya cazó uno: el T.A.R. abría el reconocedor nativo fuera de la sesión en su   */
/*  vía «solo reconocimiento» (dispositivo sin motor de captura).                */
/*                                                                             */
/*  Referencia: docs/design/integracion-lua.md §3.1.                            */
/* -------------------------------------------------------------------------- */

/* `export {}` convierte el fichero en MÓDULO: sin él, las declaraciones de los
 * globals de Node de abajo caerían en el ámbito global y chocarían con las del
 * otro test que también lee del disco (`verbalAssets.test.ts`). */
export {};

/* El proyecto no incluye @types/node (tipado RN puro): los globals de Node que
 * Jest sí provee se declaran localmente, como en `verbalAssets.test.ts`. */
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

interface DirEntry {
  name: string;
  isDirectory: () => boolean;
}

const SRC: string = path.resolve(__dirname, '..', '..');

/** Formas conocidas de abrir el micrófono en este repositorio. */
const MIC_MARKERS: { name: string; pattern: RegExp }[] = [
  { name: 'construye un AudioRecorder', pattern: /new\s+AudioRecorder\w*\s*\(/ },
  { name: 'reserva el recorder compartido', pattern: /\bacquireRecorder\s*\(/ },
  {
    name: 'carga el reconocedor de voz nativo',
    pattern: /(?:require|from)\s*\(?\s*['"]@react-native-voice\/voice['"]/,
  },
];

/**
 * Ficheros que abren o gestionan el micrófono y NO deben reservar la sesión,
 * con el motivo. Añadir algo aquí es una decisión consciente que se ve en el PR;
 * es el único sitio donde se puede eximir a un consumidor.
 */
const EXENTOS: Record<string, string> = {
  'Audio/sharedAudioRecorder.ts':
    'es el motor de captura: la sesión la reserva quien lo usa, no él (si la reservara, no habría forma de soltarla por módulo)',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }) as DirEntry[]) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/* Los comentarios se quitan antes de buscar: este mismo repositorio documenta
 * los nombres de las librerías en prosa, y un guardián que se dispare con una
 * mención en un comentario se desactiva a la primera semana. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

describe('acquireRecordingSession() es el punto único del micrófono', () => {
  const consumidores = walk(SRC)
    .map(file => ({
      rel: path.relative(SRC, file).split(path.sep).join('/'),
      code: stripComments(fs.readFileSync(file, 'utf8')),
    }))
    .map(f => ({
      ...f,
      markers: MIC_MARKERS.filter(m => m.pattern.test(f.code)).map(m => m.name),
    }))
    .filter(f => f.markers.length > 0);

  it('se reconocen los consumidores de micrófono del repositorio', () => {
    // Si esta lista se queda vacía, los patrones han dejado de encontrar nada
    // (una librería nueva, un renombrado) y el guardián estaría pasando en
    // vacío, que es peor que no existir.
    expect(consumidores.length).toBeGreaterThanOrEqual(4);
  });

  it('cada consumidor de micrófono reserva la sesión de grabación', () => {
    const infractores = consumidores
      .filter(f => !(f.rel in EXENTOS))
      .filter(f => !/\bacquireRecordingSession\s*\(/.test(f.code))
      .map(f => `${f.rel} (${f.markers.join(', ')})`);

    expect(infractores).toEqual([]);
  });

  it('los cuatro adaptadores clínicos conocidos siguen ahí y siguen reservándola', () => {
    // Fija los nombres del §3.1 del documento de diseño: si un módulo se
    // renombra o se mueve, el documento y el código dejan de coincidir y esto
    // avisa.
    const esperados = [
      'Screens/VoiceAnalysis/voiceMicAdapter.ts',
      'Screens/ProsodyAnalysis/prosodyMicAdapter.ts',
      'Screens/RoomNoiseCheck/noiseMicAdapter.ts',
      'Screens/Articulation/articulationAudio.ts',
    ];
    for (const rel of esperados) {
      const code = stripComments(fs.readFileSync(path.join(SRC, rel), 'utf8'));
      expect(code).toMatch(/\bacquireRecordingSession\s*\(/);
    }
  });

  it('el T.A.R. reserva la sesión también en la vía de solo reconocimiento', () => {
    // Regresión del hueco encontrado al integrar Lúa: la reserva estaba DENTRO
    // del `if (availableRef.current)` de la captura en memoria, así que un
    // dispositivo sin motor de captura escuchaba por el reconocedor nativo sin
    // sesión reservada. Se comprueba que la reserva precede al arranque del
    // reconocimiento en el fichero.
    const code = stripComments(
      fs.readFileSync(path.join(SRC, 'Screens/Articulation/articulationAudio.ts'), 'utf8'),
    );
    const reserva = code.indexOf('releaseSessionRef.current = acquireRecordingSession()');
    const reconocimiento = code.indexOf('startRecognition(targetWord, targetPhoneme)');
    expect(reserva).toBeGreaterThan(-1);
    expect(reconocimiento).toBeGreaterThan(-1);
    expect(reserva).toBeLessThan(reconocimiento);
  });
});
