import { ageInYearsFromDob } from '@/Helpers/patientAge';
import { ageFromDob, consentReady, isMinorAge, signerOptionsFor } from '../consentRules';

declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const SCREEN = fs.readFileSync(path.join(__dirname, '..', 'ConsentimientoScreen.tsx'), 'utf8');
const RULES = fs.readFileSync(path.join(__dirname, '..', 'consentRules.ts'), 'utf8');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function fnSource(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`no encuentro ${name}`);
  const open = src.indexOf('{', src.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}' && --depth === 0) return norm(src.slice(start, i + 1));
  }
  throw new Error('llaves sin cerrar');
}

describe('consentRules == ConsentimientoScreen.tsx (leído como texto)', () => {
  it('la cifra de mayoría de edad es la misma en el .ts y en el .tsx', () => {
    const tsx = SCREEN.match(/const minor = age < (\d+);/);
    const ts = RULES.match(/const minor = age < (\d+);/);
    expect(tsx).not.toBeNull();
    expect(ts).not.toBeNull();
    expect(Number(ts![1])).toBe(Number(tsx![1]));
    expect(Number(ts![1])).toBe(18);
  });

  it('ageFromDob es literalmente la de la pantalla', () => {
    expect(fnSource(RULES, 'ageFromDob')).toBe(fnSource(SCREEN, 'ageFromDob'));
  });

  it('las opciones de firmante y las condiciones de `ready` aparecen igual en la pantalla', () => {
    for (const frag of [
      'if (isMinor === true) return [guardian];',
      'if (isMinor === false) return [patient, family];',
      'return [guardian, patient, family];',
      "const needsRelation = signerType !== 'patient';",
      "const needsReason = signerType === 'family';",
      '!!signerName.trim() &&',
      '(!needsRelation || !!signerRelation.trim()) &&',
      '(!needsReason || !!incapacityReason.trim()) &&',
      'agreed.every(Boolean) &&',
      'signaturePaths.length > 0',
    ]) {
      expect(norm(SCREEN)).toContain(norm(frag));
      expect(norm(RULES)).toContain(norm(frag));
    }
  });
});

describe('ageFromDob / isMinorAge', () => {
  afterEach(() => jest.useRealTimers());
  const today = (y: number, m: number, d: number) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(y, m - 1, d, 12, 0, 0));
  };

  it('18 años justo hoy: adulto; mañana cumple: aún menor', () => {
    today(2026, 6, 15);
    expect(ageFromDob('2008-06-15')).toBe(18);
    expect(isMinorAge(ageFromDob('2008-06-15')!)).toBe(false);
    expect(ageFromDob('2008-06-16')).toBe(17);
    expect(isMinorAge(ageFromDob('2008-06-16')!)).toBe(true);
  });

  it('29 de febrero', () => {
    today(2026, 2, 28);
    expect(ageFromDob('2008-02-29')).toBe(17);
    today(2026, 3, 1);
    expect(ageFromDob('2008-02-29')).toBe(18);
  });

  it('fecha vacía, ausente o inválida: null (la pantalla no decide ni menor ni mayor)', () => {
    today(2026, 6, 15);
    for (const v of [undefined, null, '', '  ', 'x', '2008-6-5', '2008-13-01', '2008-06-32']) {
      expect(ageFromDob(v)).toBeNull();
    }
  });

  it('con edad desconocida se ofrecen las tres opciones: nunca se presume adulto', () => {
    expect(signerOptionsFor(null).map(o => o.value)).toEqual(['guardian', 'patient', 'family']);
    expect(signerOptionsFor(true).map(o => o.value)).toEqual(['guardian']);
    expect(signerOptionsFor(false).map(o => o.value)).toEqual(['patient', 'family']);
  });

  it('coincide con ageInYearsFromDob (patientAge) en una rejilla de fechas', () => {
    const dobs = ['2008-02-29', '2008-06-15', '2020-12-31', '2026-01-01'];
    const days: Array<[number, number, number]> = [
      [2026, 2, 28], [2026, 3, 1], [2026, 6, 14], [2026, 6, 15], [2026, 6, 16], [2027, 1, 1], [2028, 2, 29],
    ];
    for (const [y, m, d] of days) {
      today(y, m, d);
      for (const dob of dobs) {
        expect(ageFromDob(dob)).toBe(ageInYearsFromDob(dob, new Date(y, m - 1, d, 12)));
      }
    }
  });

  // La pantalla devuelve una edad NEGATIVA para una fecha futura, y `-1 < 18`
  // la trata como MENOR (rama segura: pide tutor). patientAge devuelve null.
  it('fecha futura: la pantalla la trata como menor (rama segura), no como adulto', () => {
    today(2026, 6, 15);
    const age = ageFromDob('2030-01-01');
    expect(age).toBeLessThan(0);
    expect(isMinorAge(age!)).toBe(true);
  });
});

describe('consentReady', () => {
  const base = {
    signerType: 'guardian' as const,
    signerName: 'Ana',
    signerRelation: 'Madre',
    incapacityReason: '',
    agreed: [true, true],
    signaturePaths: ['M0,0'],
  };
  it('tutor completo: listo', () => expect(consentReady(base)).toBe(true));
  it('tutor sin parentesco: no', () => expect(consentReady({ ...base, signerRelation: ' ' })).toBe(false));
  it('paciente no necesita parentesco', () =>
    expect(consentReady({ ...base, signerType: 'patient', signerRelation: '' })).toBe(true));
  it('representante exige motivo de incapacidad', () => {
    expect(consentReady({ ...base, signerType: 'family' })).toBe(false);
    expect(consentReady({ ...base, signerType: 'family', incapacityReason: 'Alzheimer' })).toBe(true);
  });
  it('sin firma, sin nombre o sin todas las casillas: no', () => {
    expect(consentReady({ ...base, signaturePaths: [] })).toBe(false);
    expect(consentReady({ ...base, signerName: '  ' })).toBe(false);
    expect(consentReady({ ...base, agreed: [true, false] })).toBe(false);
  });
});
