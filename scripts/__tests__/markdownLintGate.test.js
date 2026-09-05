/* -------------------------------------------------------------------------- */
/*  El gate de Markdown: mismo comando en local y en CI, y estilo de lista     */
/*  FIJO.                                                                     */
/*                                                                            */
/*  `main` estuvo cinco días con el aspa roja (31/8 → 5/9/2026) por tres       */
/*  viñetas de `docs/design/arquitectura-corpus-voz.md`. Dos cosas lo          */
/*  permitieron, y este fichero vigila las dos:                               */
/*                                                                            */
/*   · MD004 estaba en su modo por defecto, `consistent`: el estilo lo decide  */
/*     el PRIMER marcador de cada fichero, así que escribir una lista con `-`  */
/*     —lo natural, y lo que usan 27 de los 31 ficheros con listas— rompía    */
/*     el CI en un fichero que arrancaba con `+`. El error no señalaba el      */
/*     estándar del proyecto, señalaba un accidente histórico.                 */
/*   · El CI usaba `DavidAnson/markdownlint-cli2-action`, que trae SU PROPIA   */
/*     versión de markdownlint. No había forma de correr el gate en local      */
/*     antes de empujar, así que el fallo solo se veía cuando ya estaba en     */
/*     `main`. Es la figura que CLAUDE.md §2 prohíbe: un gate que nadie puede  */
/*     cumplir. Ahora las dos puntas ejecutan `npm run lint:md`.               */
/*                                                                            */
/*  Va en `.js` y fuera de `src/` por lo mismo que sus vecinos: el tsconfig    */
/*  de la app no trae los tipos de Node.                                      */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const WORKFLOW = '.github/workflows/markdown-lint.yml';

describe('package.json · el gate se puede correr en local', () => {
  const pkg = JSON.parse(read('package.json'));

  it('define el script `lint:md`', () => {
    expect(typeof pkg.scripts['lint:md']).toBe('string');
  });

  it('pinea una versión EXACTA de markdownlint-cli2', () => {
    // Sin versión exacta, local y CI corren reglas distintas el día que
    // markdownlint publique una regla nueva, y el CI se pone rojo por algo
    // que en local pasaba.
    expect(pkg.scripts['lint:md']).toMatch(/markdownlint-cli2@\d+\.\d+\.\d+/);
  });

  it('lintea todos los `.md`, no un subconjunto', () => {
    expect(pkg.scripts['lint:md']).toContain('**/*.md');
  });

  it('excluye `node_modules`', () => {
    // El CI linteaba 36 ficheros porque su checkout no tiene dependencias
    // instaladas. En local, con `node_modules` puesto, el mismo glob se comía
    // los README de las dependencias y escupía miles de errores ajenos: el
    // gate local quedaba inservible y el desarrollador lo ignoraba, que es
    // justo lo que este fichero intenta evitar.
    expect(pkg.scripts['lint:md']).toContain('!node_modules');
  });
});

describe('CI · corre el MISMO comando que el local', () => {
  const wf = read(WORKFLOW);

  it('invoca `npm run lint:md`', () => {
    expect(wf).toMatch(/npm run lint:md/);
  });

  it('NO usa una action de markdownlint con su propia versión', () => {
    // Reintroducirla devuelve la divergencia local/CI que costó los cinco días.
    const usos = wf
      .split('\n')
      .filter(l => /^\s*-?\s*uses:/.test(l) && /markdownlint/i.test(l));
    expect(usos).toEqual([]);
  });

  it('se dispara cuando cambia la configuración, no solo los `.md`', () => {
    expect(wf).toContain('.markdownlint.yaml');
  });
});

describe('.markdownlint.yaml · MD004 con estilo fijo', () => {
  const cfg = read('.markdownlint.yaml');

  it('declara MD004 con un `style` explícito', () => {
    // `consistent` (el defecto) hace que el estándar de cada fichero dependa
    // de su primera lista. Un estilo fijo señala la línea que se desvía del
    // proyecto.
    expect(cfg).toMatch(/^MD004:/m);
    expect(cfg).toMatch(/^\s+style:\s*(dash|asterisk|plus)\s*$/m);
  });

  it('el estilo declarado es el que ya usan los ficheros del repo', () => {
    const declarado = cfg.match(/^\s+style:\s*(dash|asterisk|plus)\s*$/m)[1];
    expect(declarado).toBe('dash');
  });
});
