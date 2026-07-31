import {
  EF_CONSIGNA_LANGS,
  TAR_MODEL_LANGS,
  bankLangs,
  efConsignaByLang,
  efRuleConsignaByLang,
  isSpokenTextDegraded,
  resolveSpokenText,
  tarModelByLang,
} from '@/Voice';
import { EF_DOMAIN_ORDER } from '@/Screens/ExecutiveFunctions/executiveFunctionsGame';

/* -------------------------------------------------------------------------- */
/*  INVARIANTE DE CORRESPONDENCIA texto ↔ voz.                                 */
/*                                                                             */
/*  El defecto que fija esta prueba: la app pasaba la lengua de SESIÓN como     */
/*  lengua de locución sin mirar en qué lengua estaba el texto. Con una sesión  */
/*  gallega y un banco que solo tiene castellano, eso produce una voz gallega   */
/*  leyendo castellano. La regla es: la lengua de una locución es la del TEXTO. */
/* -------------------------------------------------------------------------- */

describe('resolveSpokenText · la voz es la del texto, no la de la sesión', () => {
  it('con texto propio, locuta en la lengua de sesión', () => {
    expect(resolveSpokenText({ es: 'ventana', gl: 'ventá' }, 'gl')).toEqual({
      text: 'ventá',
      lang: 'gl',
    });
  });

  it('idioma COMPLETO sin texto propio → texto castellano CON VOZ CASTELLANA', () => {
    // Lo que hacía antes: devolver el texto castellano y pedir voz `gl`.
    for (const lang of ['gl', 'eu'] as const) {
      expect(resolveSpokenText({ es: 'ventana' }, lang)).toEqual({
        text: 'ventana',
        lang: 'es',
      });
    }
  });

  it('VARIANTE sin texto propio → hereda el texto y CONSERVA su voz', () => {
    // es-DO es la misma lengua: el texto peninsular con voz dominicana es
    // exactamente lo que pide una sesión dominicana.
    expect(resolveSpokenText({ es: 'ventana' }, 'es-DO')).toEqual({
      text: 'ventana',
      lang: 'es-DO',
    });
  });

  it('el texto propio de la variante gana al heredado', () => {
    expect(resolveSpokenText({ es: 'autobús', 'es-DO': 'guagua' }, 'es-DO')).toEqual({
      text: 'guagua',
      lang: 'es-DO',
    });
  });

  it('un texto vacío o en blanco no cuenta como texto de esa lengua', () => {
    expect(resolveSpokenText({ es: 'ventana', gl: '   ' }, 'gl')).toEqual({
      text: 'ventana',
      lang: 'es',
    });
  });

  it('sin texto por ninguna vía devuelve null (el llamador calla)', () => {
    expect(resolveSpokenText({}, 'gl')).toBeNull();
    expect(resolveSpokenText({ gl: 'ventá' }, 'eu')).toBeNull();
  });

  it('marca como degradada la locución que no sale en la lengua de sesión', () => {
    expect(isSpokenTextDegraded(resolveSpokenText({ es: 'ventana' }, 'gl'), 'gl')).toBe(true);
    expect(isSpokenTextDegraded(resolveSpokenText({ es: 'ventana' }, 'es-DO'), 'es-DO')).toBe(false);
    expect(isSpokenTextDegraded(null, 'gl')).toBe(false);
  });

  it('NUNCA devuelve un texto castellano con lengua de un idioma completo', () => {
    // Formulación directa del síntoma reportado, sobre todos los bancos reales.
    const bancos = [
      ...EF_DOMAIN_ORDER.map(efConsignaByLang),
      efRuleConsignaByLang('color', true),
      efRuleConsignaByLang('forma', false),
      tarModelByLang('Casa'),
    ];
    for (const banco of bancos) {
      for (const sesion of ['gl', 'eu'] as const) {
        const spoken = resolveSpokenText(banco, sesion);
        expect(spoken).not.toBeNull();
        // Si el texto que sale es el castellano, la voz TIENE que ser castellana.
        if (spoken!.text === banco.es) expect(spoken!.lang).toBe('es');
        else expect(spoken!.lang).toBe(sesion);
      }
    }
  });
});

describe('bankLangs · un selector no puede ofrecer lo que el banco no tiene', () => {
  it('solo cuenta una lengua si TODAS las entradas la tienen', () => {
    expect(bankLangs([{ es: 'a', gl: 'A' }, { es: 'b' }])).toEqual(['es', 'es-DO']);
    expect(bankLangs([{ es: 'a', gl: 'A' }, { es: 'b', gl: 'B' }])).toEqual(['es', 'gl', 'es-DO']);
  });

  it('la variante cuenta como cubierta si lo está su base', () => {
    expect(bankLangs([{ es: 'a' }])).toEqual(['es', 'es-DO']);
  });

  it('un banco vacío no ofrece ninguna lengua', () => {
    expect(bankLangs([])).toEqual([]);
  });

  it('los bancos reales de FE y T.A.R. ofrecen castellano y dominicano', () => {
    // Ni gallego ni euskera: sus deltas no están firmados y el inventario
    // T.A.R. es de fonología castellana. Ofrecerlos era la promesa incumplida.
    expect(EF_CONSIGNA_LANGS).toEqual(['es', 'es-DO']);
    expect(TAR_MODEL_LANGS).toEqual(['es', 'es-DO']);
  });
});
