import { computeParams } from '../useVoiceAnalysis';

/* -------------------------------------------------------------------------- */
/*  Regresión: una toma con voz suficiente pero SIN formantes estimables ya   */
/*  no debe acabar en «captura insuficiente». Los formantes son un extra:     */
/*  si la LPC no los resuelve, el resultado sale con `formants: null` y el    */
/*  resto de parámetros (F0, jitter, shimmer, HNR) intactos, y la prueba se   */
/*  puede completar y firmar.                                                 */
/* -------------------------------------------------------------------------- */

const series = (value: number, count: number): number[] => Array(count).fill(value);

describe('computeParams – suficiencia de la toma', () => {
  const base = {
    f0s: series(220, 20),
    amplitudes: series(0.1, 20),
    hnrs: series(18, 20),
  };

  it('sin formantes devuelve igualmente el resultado (formants: null)', () => {
    const r = computeParams({ ...base, formants: null });
    expect(r).not.toBeNull();
    expect(r!.formants).toBeNull();
    expect(r!.f0).toBeCloseTo(220, 0);
    expect(r!.jitter).toBe(0);
    expect(r!.hnr).toBeCloseTo(18, 1);
  });

  it('con formantes los conserva', () => {
    const formants = { f1: 900, f2: 1500, f3: 2900 };
    const r = computeParams({ ...base, formants });
    expect(r).not.toBeNull();
    expect(r!.formants).toEqual(formants);
  });

  it('con muy pocas ventanas sonoras sigue devolviendo null (insuficiente de verdad)', () => {
    const r = computeParams({
      f0s: series(220, 3),
      amplitudes: series(0.1, 3),
      hnrs: series(18, 3),
      formants: null,
    });
    expect(r).toBeNull();
  });

  it('ventanas con F0 fuera de banda no cuentan como voz', () => {
    const r = computeParams({
      f0s: series(950, 20), // fuera del rango 65–520 Hz
      amplitudes: series(0.1, 20),
      hnrs: series(18, 20),
      formants: null,
    });
    expect(r).toBeNull();
  });
});
