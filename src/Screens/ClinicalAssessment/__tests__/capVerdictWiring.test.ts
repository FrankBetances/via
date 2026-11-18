export {};

/* -------------------------------------------------------------------------- */
/*  CAP «NO APTO»: avisa y deja seguir (Frank, 18/11/2026).                    */
/*                                                                            */
/*  Hasta esa fecha `capApproved` solo se escribía `false` y el hub no sabía  */
/*  nada del CAP. Ahora la pantalla del CAP guarda el resultado real y el hub */
/*  pinta el aviso solo con un «NO APTO» leído.                               */
/* -------------------------------------------------------------------------- */

// Mismo patrón que `src/Lua/__tests__/luaProtocolGate.test.ts`: sin tipos de Node.
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const read = (rel: string): string => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('veredicto del CAP', () => {
  it('la pantalla del CAP guarda el resultado real en la evaluación', () => {
    const code = read('ClinicalAssessment/ClinicalAssessmentScreen.tsx');
    expect(code).toMatch(/EvaluationRepository\.markCap\(evaluationId, a\.global !== 'BLOCKED', a\.globalLabel\)/);
  });

  it('el hub lee el último CAP y solo avisa con un «NO APTO» leído', () => {
    const code = read('SeleccionEjercicios/SeleccionEjerciciosScreen.tsx');
    expect(code).toMatch(/setCapBlocked\(cap\?\.globalResult === 'BLOCKED'\)/);
    expect(code).toMatch(/\{capBlocked \? \(/);
    // Sin lectura no se afirma nada.
    expect(code).toMatch(/catch \{[\s\S]{0,140}setCapBlocked\(false\)/);
  });
});
