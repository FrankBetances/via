import { ORBIT_MODULES, ORBIT_MAX_REACH } from '../orbitModules';

/* La constelación de la pantalla de créditos afirma algo verificable: que hay
   DOCE módulos, que empiezan en el CAP y terminan en Funciones Ejecutivas, y
   que ninguno comparte órbita ni velocidad con otro (si lo hicieran, girarían
   pegados y el conjunto dejaría de recomponerse). */

describe('ORBIT_MODULES', () => {
  it('son exactamente los doce módulos de la batería', () => {
    expect(ORBIT_MODULES).toHaveLength(12);
  });

  it('van del CAP a Funciones Ejecutivas, en el orden del flujo clínico', () => {
    expect(ORBIT_MODULES[0].key).toBe('cap');
    expect(ORBIT_MODULES[ORBIT_MODULES.length - 1].key).toBe('ejecutivas');
  });

  it('no repite identificadores', () => {
    const keys = new Set(ORBIT_MODULES.map(m => m.key));
    expect(keys.size).toBe(ORBIT_MODULES.length);
  });

  it('cada punto lleva radio y velocidad propios', () => {
    const radios = new Set(ORBIT_MODULES.map(m => m.radius));
    const periodos = new Set(ORBIT_MODULES.map(m => m.durationMs));
    expect(radios.size).toBe(ORBIT_MODULES.length);
    expect(periodos.size).toBe(ORBIT_MODULES.length);
  });

  it('reparte las fases por el círculo sin salirse de él', () => {
    const fases = new Set(ORBIT_MODULES.map(m => m.phase));
    expect(fases.size).toBe(ORBIT_MODULES.length);
    ORBIT_MODULES.forEach(m => {
      expect(m.phase).toBeGreaterThanOrEqual(0);
      expect(m.phase).toBeLessThan(360);
    });
  });

  it('declara el alcance máximo que debe caber en el lienzo', () => {
    const esperado = Math.max(...ORBIT_MODULES.map(m => m.radius + m.size / 2));
    expect(ORBIT_MAX_REACH).toBe(esperado);
  });
});
