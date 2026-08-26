import { evaluateAshaScreening } from '../ashaCdssEngine';
import {
  ASHA_AGE_BANDS,
  ASHA_MILESTONES,
  getMilestonesForAgeBand,
  resolveAgeBandFromMonths,
  type AshaAgeBand,
} from '../ashaMilestones';

/* -------------------------------------------------------------------------- */
/*  Motor CDSS del cribado ASHA.                                               */
/*                                                                            */
/*  Es una función pura y determinista, y de ella salen el nivel de riesgo y   */
/*  las derivaciones que se imprimen en el informe. Lo que estas pruebas       */
/*  vigilan no es que «funcione»: es que un hito SIN CONTESTAR nunca cuente    */
/*  como fallado, porque eso convertiría un cribado a medias en una bandera    */
/*  roja que nadie ha observado.                                               */
/* -------------------------------------------------------------------------- */

const bandOf = (id: string): AshaAgeBand => id as AshaAgeBand;
const ALL_BANDS = ASHA_AGE_BANDS.map(b => bandOf(b.id));

const allOf = (band: AshaAgeBand, value: boolean) =>
  Object.fromEntries(getMilestonesForAgeBand(band).map(m => [m.id, value]));

describe('catálogo de hitos', () => {
  it('cada banda tiene hitos y todos declaran una banda existente', () => {
    for (const band of ALL_BANDS) {
      expect(getMilestonesForAgeBand(band).length).toBeGreaterThan(0);
    }
    const known = new Set<string>(ALL_BANDS);
    for (const m of ASHA_MILESTONES) expect(known.has(m.ageBand)).toBe(true);
  });

  it('los identificadores de hito no se repiten', () => {
    const ids = ASHA_MILESTONES.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolveAgeBandFromMonths cubre 0–5 años sin huecos ni saltos', () => {
    const order = ALL_BANDS;
    let previous = -1;
    for (let months = 0; months <= 72; months++) {
      const index = order.indexOf(resolveAgeBandFromMonths(months));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeGreaterThanOrEqual(previous); // nunca retrocede
      previous = index;
    }
  });
});

describe('evaluateAshaScreening · estratificación de riesgo', () => {
  it.each(ALL_BANDS)('en %s, todo cumplido es VERDE y sin derivaciones clínicas', band => {
    const r = evaluateAshaScreening(allOf(band, true), getMilestonesForAgeBand(band));
    expect(r.riskLevel).toBe('green');
    expect(r.failedDomains).toEqual([]);
    expect(r.redFlagsDetected).toEqual([]);
    expect(r.recommendedReferrals).toEqual([
      'Pautas generales de estimulación (lectura dialógica)',
    ]);
  });

  it.each(ALL_BANDS)('en %s, todo fallado da el máximo riesgo que la banda permite', band => {
    const milestones = getMilestonesForAgeBand(band);
    const r = evaluateAshaScreening(allOf(band, false), milestones);
    const hasRedFlags = milestones.some(m => m.isRedFlag);
    expect(r.riskLevel).toBe(hasRedFlags ? 'red' : 'yellow');
    expect(r.failedCount).toBe(milestones.length);
  });

  it('DEJA CONSTANCIA de qué bandas pueden llegar a ROJO', () => {
    // LIMITACIÓN DEL CATÁLOGO, no del motor: las banderas rojas están todas
    // entre 0 y 36 meses. En 3-4y y 4-5y no hay ninguna, así que un niño de
    // cuatro años que FALLE LOS TRES hitos de su banda sale «riesgo moderado ·
    // watchful waiting», nunca rojo, y el informe no pide derivación urgente.
    //
    // Puede ser deliberado (las señales de alerta de ASHA se concentran en la
    // primera infancia) o puede ser un hueco del catálogo. Se fija aquí para
    // que la decisión sea explícita y no se herede sin que nadie la mire:
    // si se añade una bandera roja en esas bandas, este test lo dirá.
    const conBanderaRoja = ALL_BANDS.filter(b =>
      getMilestonesForAgeBand(b).some(m => m.isRedFlag),
    );
    expect(conBanderaRoja).toEqual(['0-6m', '7-12m', '13-18m', '19-24m', '2-3y']);
  });

  it('un fallo SIN bandera roja es AMARILLO, no rojo', () => {
    const milestones = getMilestonesForAgeBand('4-5y');
    const plain = milestones.find(m => !m.isRedFlag);
    expect(plain).toBeDefined();
    const responses = allOf('4-5y', true);
    responses[plain!.id] = false;
    const r = evaluateAshaScreening(responses, milestones);
    expect(r.riskLevel).toBe('yellow');
    expect(r.redFlagsDetected).toEqual([]);
  });

  it('UNA sola bandera roja basta para ROJO aunque el resto cumpla', () => {
    const milestones = ASHA_MILESTONES.filter(m => m.ageBand === '19-24m');
    const flag = milestones.find(m => m.isRedFlag);
    expect(flag).toBeDefined();
    const responses = allOf('19-24m', true);
    responses[flag!.id] = false;
    expect(evaluateAshaScreening(responses, milestones).riskLevel).toBe('red');
  });
});

describe('evaluateAshaScreening · un hito sin contestar NO es un hito fallado', () => {
  const milestones = getMilestonesForAgeBand('2-3y');

  it('sin ninguna respuesta no hay riesgo ni dominios comprometidos', () => {
    const r = evaluateAshaScreening({}, milestones);
    expect(r.riskLevel).toBe('green');
    expect(r.failedCount).toBe(0);
    expect(r.totalEvaluated).toBe(0);
    expect(r.failedDomains).toEqual([]);
  });

  it('`null` y `undefined` no cuentan como cumplido ni como fallado', () => {
    const responses: Record<string, boolean | null | undefined> = allOf('2-3y', true);
    const first = milestones[0].id;
    responses[first] = null;
    responses[milestones[1].id] = undefined;
    const r = evaluateAshaScreening(responses, milestones);
    expect(r.riskLevel).toBe('green');
    expect(r.totalEvaluated).toBe(milestones.length - 2);
    expect(r.achievedCount).toBe(milestones.length - 2);
  });
});

describe('evaluateAshaScreening · rutas de derivación', () => {
  const milestones = getMilestonesForAgeBand('4-5y');
  const failOnly = (domain: 'receptive' | 'expressive' | 'pragmatic') => {
    const responses = allOf('4-5y', true);
    for (const m of milestones) if (m.domain === domain) responses[m.id] = false;
    return evaluateAshaScreening(responses, milestones);
  };

  it('receptivo + expresivo deriva a ORL y Neuropediatría', () => {
    const responses = allOf('4-5y', true);
    for (const m of milestones) {
      if (m.domain === 'receptive' || m.domain === 'expressive') responses[m.id] = false;
    }
    const r = evaluateAshaScreening(responses, milestones);
    expect(r.recommendedReferrals).toContain(
      'Derivación a ORL (descartar hipoacusia) y Neuropediatría',
    );
  });

  it('pragmático deriva a Atención Temprana o Psicología Infantil', () => {
    expect(failOnly('pragmatic').recommendedReferrals).toContain(
      'Derivación a Atención Temprana o Psicología Infantil',
    );
  });

  it('solo expresivo deriva a Logopedia clínica', () => {
    expect(failOnly('expressive').recommendedReferrals).toContain(
      'Derivación a Logopedia clínica (evaluación morfosintáctica)',
    );
  });

  it('un cribado con algún fallo SIEMPRE sale con al menos una recomendación', () => {
    // Sin esto, un riesgo amarillo por un dominio receptivo aislado dejaba el
    // informe con la sección de derivaciones vacía y sin decir qué hacer.
    for (const domain of ['receptive', 'expressive', 'pragmatic'] as const) {
      const r = failOnly(domain);
      expect(r.riskLevel).not.toBe('green');
      expect(r.recommendedReferrals.length).toBeGreaterThan(0);
    }
  });
});
