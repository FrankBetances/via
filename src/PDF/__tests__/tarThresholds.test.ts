import { TAR_PCT, tarStatus } from '@/PDF/nlgThresholds';

// Mismo patrón que `src/Lua/__tests__/luaProtocolGate.test.ts`: el proyecto
// no trae los tipos de Node, y estos tests leen ficheros fuente.
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

/* -------------------------------------------------------------------------- */
/*  Semáforo del T.A.R.: un solo corte (Frank, 17/11/2026: 90/70).            */
/*                                                                            */
/*  Hasta esa fecha convivían dos juegos de cifras: 85/60 en la pantalla de   */
/*  la prueba y en el PDF, 90/70 en las tarjetas de resultados. Un 87 % salía */
/*  verde al terminar y ámbar en el resumen. Este test falla si alguien       */
/*  vuelve a escribir un corte a mano en cualquiera de los cinco sitios.      */
/* -------------------------------------------------------------------------- */

const SRC: string = path.join(__dirname, '..', '..');

const SITES = [
  'Screens/Articulation/ArticulationTestScreen.tsx',
  'Screens/ResultadosPreliminares/evaluationResults.ts',
  'Screens/ResultadosFinal/ResultadosFinalScreen.tsx',
  'PDF/blocks/ArticulationDetail.ts',
];

describe('T.A.R. · corte único del semáforo', () => {
  it('las cifras son las decididas', () => {
    expect(TAR_PCT).toEqual({ ok: 90, warn: 70 });
  });

  it('cada borde cae en su lado', () => {
    expect(tarStatus(100)).toBe('ok');
    expect(tarStatus(90)).toBe('ok');
    expect(tarStatus(89)).toBe('warn');
    expect(tarStatus(87)).toBe('warn');
    expect(tarStatus(70)).toBe('warn');
    expect(tarStatus(69)).toBe('alt');
    expect(tarStatus(0)).toBe('alt');
  });

  it.each(SITES)('%s no lleva un corte del % escrito a mano', rel => {
    const code: string = fs.readFileSync(path.join(SRC, rel), 'utf8');
    expect(code).not.toMatch(/(correctPct|pct)\s*>=?\s*\d/);
    expect(code).toMatch(/TAR_PCT|tarStatus/);
  });
});
