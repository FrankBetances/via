/* -------------------------------------------------------------------------- */
/*  El informe de literales fuera del catálogo (E1, H6 del plan de mejora).    */
/*                                                                            */
/*  `scripts/report-ui-literals.js` existe porque `check-ui-strings.js` no ve  */
/*  los argumentos de `show*Toast` ni de `Alert.alert`, ni los textos de los   */
/*  `.ts` que alimentan pantallas. Si el informe dejara de detectarlos, su     */
/*  recuento sería un cero tranquilizador y falso: justo lo que la regla 3 de  */
/*  CLAUDE.md prohíbe en un test. Por eso cada caso aquí lleva su fixture y,   */
/*  abajo, la prueba de que sale 0 SIEMPRE (es un informe, no un gate).        */
/* -------------------------------------------------------------------------- */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { scanText } = require('../report-ui-literals');

const SCRIPT = path.resolve(__dirname, '..', 'report-ui-literals.js');

const kinds = r => r.found.map(f => `${f.kind}:${f.detail}`);

describe('report-ui-literals · (a) argumentos de toast y Alert', () => {
  it('detecta el texto literal de showSuccessToast y showErrorToast en un .tsx', () => {
    const src = [
      "showSuccessToast('Registro guardado', 'Todo correcto.');",
      "showErrorToast('Error al guardar', t.common.retry);",
    ].join('\n');
    const r = scanText(src, 'src/Screens/X/XScreen.tsx', true);
    expect(kinds(r)).toEqual([
      'toast:showSuccessToast',
      'toast:showSuccessToast',
      'toast:showErrorToast',
    ]);
    // El segundo argumento del error viene del catálogo: no es literal.
    expect(r.found.map(f => f.line)).toEqual([1, 1, 2]);
  });

  it('detecta el texto literal de Alert.alert, y también en un .ts', () => {
    const src = "Alert.alert('Permiso denegado', `Falta ${x} para continuar`);";
    const r = scanText(src, 'src/Helpers/perm.ts', false);
    expect(kinds(r)).toEqual(['alert:Alert.alert', 'alert:Alert.alert']);
  });

  it('cuenta las llamadas aparte de los literales (título + mensaje = 1 llamada)', () => {
    const r = scanText("showErrorToast('No se puede guardar', 'Sin evaluación activa.');", 'a.tsx', true);
    expect(r.found).toHaveLength(2);
    expect(new Set(r.found.map(f => f.call)).size).toBe(1);
  });

  it('no marca un toast cuyo texto sale del catálogo', () => {
    const r = scanText('showErrorToast(t.toast.title, t.toast.body);', 'a.tsx', true);
    expect(r.found).toHaveLength(0);
  });

  it('respeta `// i18n-exempt: motivo`, en la línea o en la anterior', () => {
    const src = [
      "showErrorToast('Texto exento', 'Cuerpo exento'); // i18n-exempt: nombre propio",
      '// i18n-exempt: diagnóstico técnico',
      "Alert.alert('Otro exento');",
      "showErrorToast('Este no está exento');",
    ].join('\n');
    const r = scanText(src, 'a.tsx', true);
    expect(r.found.map(f => f.sample)).toEqual(['Este no está exento']);
    expect(r.exempted).toBe(3);
  });

  it('una exención SIN motivo no vale', () => {
    const src = "// i18n-exempt:\nshowErrorToast('Sin motivo');";
    const r = scanText(src, 'a.tsx', true);
    expect(r.found).toHaveLength(1);
  });
});

describe('report-ui-literals · (b) propiedades de texto en .ts', () => {
  it('detecta una frase en title/label/description y no un identificador', () => {
    const src = [
      "export const A = { title: 'Audiometría Verbal', label: 'audio', description: 'una frase suelta' };",
      "export const B = { key: 'Algo Que No Se Lee', title: 'f0' };",
    ].join('\n');
    const r = scanText(src, 'src/Screens/X/moduleCards.ts', false);
    expect(r.found.map(f => `${f.detail}:${f.sample}`)).toEqual([
      'title:Audiometría Verbal',
      'description:una frase suelta',
    ]);
  });

  it('solo se aplica a .ts: en un .tsx lo cubre el gate existente', () => {
    const r = scanText("const a = { title: 'Audiometría Verbal' };", 'a.tsx', true);
    expect(r.found).toHaveLength(0);
  });
});

describe('report-ui-literals · es un informe: sale SIEMPRE con 0', () => {
  it('con hallazgos, el proceso termina con código 0 y los lista', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-literals-'));
    try {
      const dir = path.join(tmp, 'src', 'Screens');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'A.tsx'), "showErrorToast('Fallo literal', 'Otro texto');\n");
      fs.writeFileSync(path.join(dir, 'b.ts'), "export const C = { title: 'Título visible' };\n");
      const res = spawnSync(process.execPath, [SCRIPT, '--src', path.join(tmp, 'src')], { encoding: 'utf8' });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('src/Screens/A.tsx:1');
      expect(res.stdout).toContain('src/Screens/b.ts:1');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
