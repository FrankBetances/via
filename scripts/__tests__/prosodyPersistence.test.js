/* -------------------------------------------------------------------------- */
/*  Guardias de arquitectura de la persistencia del módulo de prosodia (B3).   */
/*                                                                            */
/*  Inspeccionan el FUENTE, no el runtime, por el mismo motivo que             */
/*  `voiceArchitecture.test.js`: comprobarlo de verdad exigiría levantar el    */
/*  DataSource con el driver nativo de SQLite, que no existe bajo Jest.        */
/*                                                                            */
/*  Van en `.js` y fuera de `src/` a propósito: el `tsconfig` de la app no     */
/*  incluye los tipos de Node, así que un test en TypeScript que use `fs`      */
/*  rompe `npm run tsc` aunque Jest lo ejecute sin problema.                   */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('prosodia · registro en el DataSource', () => {
  /* Con `synchronize: true`, lo ÚNICO que crea la tabla es que la entidad esté
   * en el array `entities` de `src/Database/config.ts`. Si se olvida, el
   * modelo, el repositorio y los servicios compilan y pasan el typecheck sin
   * una queja: el fallo aparece en ejecución, con la primera escritura de un
   * paciente real. */
  const config = read('src/Database/config.ts');

  it('la entidad está importada', () => {
    expect(config).toContain("from '@/Models/ProsodyAnalysis/ProsodyAnalysis'");
  });

  it('la entidad está en el array `entities`', () => {
    const entities = config.slice(config.indexOf('entities: ['), config.indexOf('migrations:'));
    expect(entities).toContain('ProsodyAnalysis');
  });

  it('la migración opcional no colisiona de timestamp', () => {
    const dir = path.join(ROOT, 'src/Database/migrations');
    const stamps = fs
      .readdirSync(dir)
      .map(f => f.split('-')[0])
      .filter(Boolean);
    expect(new Set(stamps).size).toBe(stamps.length);
    expect(stamps).toContain('1718900000600');
  });
});

describe('prosodia · servicios locales', () => {
  it('el registro central reexporta el módulo', () => {
    expect(read('src/Services/local/modules/index.ts')).toContain(
      "export * from './prosodyAnalysis'",
    );
  });

  it('expone el mismo juego de operaciones que los demás módulos', () => {
    const index = read('src/Services/local/modules/prosodyAnalysis/index.ts');
    for (const hook of [
      'useGetProsodyAnalysisByIdQuery',
      'useLazyGetProsodyAnalysisByIdQuery',
      'useLazyGetProsodyAnalysisByEvaluationQuery',
      'useCreateProsodyAnalysisMutation',
      'useUpdateProsodyAnalysisMutation',
      'useDeleteProsodyAnalysisMutation',
    ]) {
      expect(index).toContain(hook);
    }
  });
});

describe('prosodia · registro del módulo en la app', () => {
  /* Un módulo que existe pero no está enrutado ni en el hub es un módulo que
   * nadie puede abrir. Las tres piezas van juntas o no va ninguna. */
  it('la ruta está declarada en RootStackParamList', () => {
    expect(read('src/Navigators/screenTypeNavigator.ts')).toContain('ProsodyAnalysis: undefined');
  });

  it('la pantalla está montada en el navegador', () => {
    const nav = read('src/Navigators/Default.tsx');
    expect(nav).toContain("from '@/Screens/ProsodyAnalysis'");
    expect(nav).toContain('name="ProsodyAnalysis"');
  });

  it('el módulo aparece en el hub de selección de pruebas', () => {
    expect(read('src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx')).toContain(
      "id: 'ProsodyAnalysis'",
    );
  });

  /* Un bloque PDF escrito pero no enganchado en la plantilla produce informes a
   * los que les falta un módulo entero, en silencio. */
  it('el bloque de informe está registrado y enganchado en la plantilla', () => {
    expect(read('src/PDF/blocks/index.ts')).toContain('ProsodyDetail');
    const report = read('src/PDF/templates/Report.ts');
    expect(report).toContain('ProsodyAnalysisRepository');
    expect(report).toContain('blocks.ProsodyDetail');
  });

  it('el informe imprime SIEMPRE la advertencia de que no hay baremo', () => {
    // B0.2: sin esta línea, una tabla de cifras en un informe clínico se lee
    // como si tuviera rangos de normalidad detrás, y no los tiene.
    const block = read('src/PDF/blocks/ProsodyDetail.ts');
    expect(block).toContain('PDF.PROSODY.DISCLAIMER');
    expect(block).toContain('sin baremo poblacional');
    // Y la tarea, sin la cual las cifras no son comparables con nada.
    expect(block).toContain('TASK_LABEL');
  });
});

describe('prosodia · Zero-PHI de la entidad', () => {
  /* La entidad guarda MÉTRICAS. Que nunca aparezca una columna de audio, de
   * transcripción o de contorno no es una convención de estilo: es la garantía
   * que sostiene el argumento Zero-PHI del módulo en el expediente. */
  const entity = read('src/Models/ProsodyAnalysis/ProsodyAnalysis.ts');
  const migration = read('src/Database/migrations/1718900000600-CreateProsodyAnalysis.ts');

  const prohibidos = ['audioUri', 'audioPath', 'pcm', 'waveform', 'transcript', 'contour', 'f0St'];

  it('la entidad no declara ningún campo de audio, transcripción ni contorno', () => {
    for (const campo of prohibidos) {
      expect(entity).not.toContain(`${campo}:`);
    }
  });

  it('la migración no crea ninguna columna de ese tipo', () => {
    for (const campo of prohibidos) {
      expect(migration).not.toContain(`name: '${campo}'`);
    }
  });

  it('la tarea se persiste: sin ella las tomas no son comparables entre sí', () => {
    // La tasa de habla depende fuertemente de la tarea, así que comparar dos
    // tomas de tareas distintas mediría el cambio de tarea, no el progreso.
    expect(entity).toContain('task: ProsodyTask');
    expect(migration).toContain("name: 'task'");
  });
});
