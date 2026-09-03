/* -------------------------------------------------------------------------- */
/*  La constelación de créditos cabe en la pantalla que tiene delante.          */
/*                                                                            */
/*  Tenía 200 px FIJOS. En un teléfono apaisado —360 px de alto, con la barra  */
/*  superior y el dock comiéndose ~156— la constelación sola no dejaba ver     */
/*  nada más. Y sus trece radios están escritos a mano en `orbitModules.ts`    */
/*  para que sea reproducible: si el envoltorio encoge y los radios no, los    */
/*  puntos se salen de la tarjeta. Eso es lo que se mide aquí.                 */
/*                                                                            */
/*  Los cortes genéricos (dos columnas, cromo compacto) están en               */
/*  `src/Theme/__tests__/screenLayout.test.ts`, que es su sitio.               */
/* -------------------------------------------------------------------------- */
import { computeCreditsLayout } from '../creditsLayout';
import { ORBIT_MODULES } from '../orbitModules';

/** Lo que se aleja del centro el punto más exterior, con su propio diámetro. */
const alcanceOrbital = (scale: number) =>
  Math.max(...ORBIT_MODULES.map(m => (m.radius + m.size / 2) * scale));

describe('computeCreditsLayout', () => {
  it('tableta apaisada: la constelación a tamaño completo', () => {
    const l = computeCreditsLayout({ winW: 1024, winH: 768 });

    expect(l.twoColumns).toBe(true);
    expect(l.emblemScale).toBe(1);
    expect(l.emblemBox).toBe(200);
    expect(l.coreSize).toBe(84);
    expect(l.isotypeSize).toBe(56);
  });

  it('teléfono estrecho: encoge, y el isotipo sigue siendo legible', () => {
    const l = computeCreditsLayout({ winW: 360, winH: 740 });

    expect(l.emblemScale).toBeLessThan(1);
    expect(l.emblemBox).toBe(164);
    // Un isotipo por debajo de ~40 px deja de leerse como marca.
    expect(l.isotypeSize).toBeGreaterThanOrEqual(40);
    // Y la tarjeta lleva 12 px de relleno a cada lado sobre 12 de scroll.
    expect(l.emblemBox + 2 * 12 + 2 * 12).toBeLessThanOrEqual(360);
  });

  it('móvil apaisado: encoge lo suficiente para dejar sitio a la barra y al dock', () => {
    const l = computeCreditsLayout({ winW: 740, winH: 360 });

    expect(l.isMobileLandscape).toBe(true);
    expect(l.emblemScale).toBe(0.7);
    expect(l.emblemBox).toBe(140);
    expect(l.emblemBox).toBeLessThan(360 - 86 - 56);
  });

  it('los TRECE puntos siguen dentro del emblema en todas las tallas', () => {
    for (const [winW, winH] of [
      [360, 740],
      [412, 892],
      [740, 360],
      [1024, 768],
    ]) {
      const l = computeCreditsLayout({ winW: winW!, winH: winH! });
      // El punto más exterior no puede pasarse del radio del envoltorio: si el
      // emblema encogiera sin escalar los radios, esto se rompe.
      expect(alcanceOrbital(l.emblemScale)).toBeLessThanOrEqual(l.emblemBox / 2 + 4);
      // Y el núcleo nunca tapa la órbita interior.
      expect(l.coreSize / 2).toBeLessThan(alcanceOrbital(l.emblemScale));
    }
  });

  it('el anillo de pulso envuelve al núcleo, no al revés', () => {
    for (const winW of [360, 412, 740, 1024]) {
      const l = computeCreditsLayout({ winW, winH: winW > 600 ? 360 : 900 });
      expect(l.ringSize).toBeGreaterThan(l.coreSize);
      expect(l.ringSize).toBeLessThanOrEqual(l.emblemBox);
    }
  });
});
