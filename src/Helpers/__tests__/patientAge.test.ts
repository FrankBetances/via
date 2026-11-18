import { ageInMonthsFromDob, ageInYearsFromDob, parseDob } from '@/Helpers/patientAge';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe('patientAge · bordes de cumpleaños', () => {
  it('el día del cumpleaños ya cuenta el año; el día anterior, no', () => {
    expect(ageInYearsFromDob('2008-06-15', at(2026, 6, 15))).toBe(18);
    expect(ageInYearsFromDob('2008-06-15', at(2026, 6, 14))).toBe(17); // cumpleaños mañana
    expect(ageInYearsFromDob('2008-06-15', at(2026, 6, 16))).toBe(18);
  });

  it('meses: el mes en curso solo cuenta pasado el día', () => {
    expect(ageInMonthsFromDob('2025-01-15', at(2025, 2, 14))).toBe(0);
    expect(ageInMonthsFromDob('2025-01-15', at(2025, 2, 15))).toBe(1);
  });

  it('29 de febrero: en año no bisiesto cumple el 1 de marzo, no el 28 de febrero', () => {
    expect(ageInYearsFromDob('2008-02-29', at(2026, 2, 28))).toBe(17);
    expect(ageInYearsFromDob('2008-02-29', at(2026, 3, 1))).toBe(18);
    expect(ageInYearsFromDob('2008-02-29', at(2028, 2, 29))).toBe(20);
    expect(ageInYearsFromDob('2008-02-29', at(2028, 2, 28))).toBe(19);
  });

  it('nacido hoy: 0 meses y 0 años', () => {
    expect(ageInMonthsFromDob('2026-11-18', at(2026, 11, 18))).toBe(0);
    expect(ageInYearsFromDob('2026-11-18', at(2026, 11, 18))).toBe(0);
  });

  it('fecha de nacimiento futura: null, no una edad negativa', () => {
    expect(ageInMonthsFromDob('2026-11-19', at(2026, 11, 18))).toBeNull();
    expect(ageInYearsFromDob('2030-01-01', at(2026, 11, 18))).toBeNull();
  });
});

describe('patientAge · fecha vacía o inválida devuelve null (nunca un valor por defecto)', () => {
  const invalid: Array<string | null | undefined> = [
    undefined, null, '', '   ', 'abc', '2008-6-5', '08-06-15', '15/06/2008', '2008-13-01', '2008-00-10', '2008-06-32', '2008-06-15T00:00:00',
  ];
  it.each(invalid)('%p -> null', v => {
    expect(parseDob(v)).toBeNull();
    expect(ageInMonthsFromDob(v, at(2026, 6, 15))).toBeNull();
    expect(ageInYearsFromDob(v, at(2026, 6, 15))).toBeNull();
  });

  it('tolera espacios alrededor de una fecha válida', () => {
    expect(ageInYearsFromDob(' 2008-06-15 ', at(2026, 6, 15))).toBe(18);
  });
});
