import { ORBIT_MODULES, ORBIT_MAX_REACH } from '../orbitModules';
import { MODULES } from '@/Screens/SeleccionEjercicios/moduleCards';

/* La constelación de la pantalla de créditos afirma algo verificable: que están
   TODOS los módulos de la batería, que empiezan en el CAP y terminan en el
   último del flujo, y que ninguno comparte órbita ni velocidad con otro (si lo
   hicieran, girarían pegados y el conjunto dejaría de recomponerse).

   El recuento se contrasta contra la parrilla del hub y los dos prerrequisitos
   que no son tarjeta (CAP y sonómetro de sala), en vez de contra un número
   escrito a mano: así, añadir un módulo y olvidarse de la órbita falla aquí.
   Pasó con el cribado ASHA en agosto de 2026 — entró en el hub, en la
   navegación y en el informe, y la pantalla de créditos siguió pintando doce
   puntos. */

describe('ORBIT_MODULES', () => {
  it('están TODOS los módulos de la batería, contados desde el hub', () => {
    // Módulos de la parrilla + los dos prerrequisitos que no son tarjeta.
    const enElHub = MODULES.length;
    expect(ORBIT_MODULES).toHaveLength(enElHub + 2);
  });

  it('van del CAP al último del flujo clínico', () => {
    expect(ORBIT_MODULES[0].key).toBe('cap');
    expect(ORBIT_MODULES[ORBIT_MODULES.length - 1].key).toBe('asha');
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
