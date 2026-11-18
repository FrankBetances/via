/* -------------------------------------------------------------------------- */
/*  «Sesión Sellada · Informe Listo» solo con la evaluación cerrada.          */
/*                                                                            */
/*  Hasta el 18/11/2026 la píldora se pintaba siempre, antes de pulsar        */
/*  «Finalizar»: un sellado que nadie había hecho (regla 4 de CLAUDE.md, la   */
/*  misma figura que el «Sala verificada» del sonómetro).                     */
/* -------------------------------------------------------------------------- */

export {};

// Mismo patrón que `src/Lua/__tests__/luaProtocolGate.test.ts`: sin tipos de Node.
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

describe('píldora de sesión sellada', () => {
  it('va dentro de la condición de evaluación completada', () => {
    const code: string = fs.readFileSync(path.join(__dirname, '..', 'ResultadosFinalScreen.tsx'), 'utf8');
    const pill = code.indexOf('sesionSelladaInformeListo');
    expect(pill).toBeGreaterThan(-1);
    const before = code.slice(Math.max(0, pill - 400), pill);
    expect(before).toMatch(/activeEvaluation\?\.status === 'completed' \?/);
  });
});
