// Report.ts importa los repositorios y con ellos la base nativa: se sustituye
// por la de memoria, como en los tests de persistencia. Aquí no se lee nada.
jest.mock('@/Database/config', () =>
  require('../../../jest/memoryDataSource').configMock(),
);

import { CONSENT_UNREADABLE_TEXT, consentCoverText } from '@/PDF/templates/Report';

/* -------------------------------------------------------------------------- */
/*  Portada del PDF: constancia del consentimiento.                           */
/*                                                                            */
/*  Hasta el 18/11/2026, si el consentimiento no se podía leer, la línea se   */
/*  omitía y el error iba solo a `console.warn`. Ahora la portada lo dice.    */
/* -------------------------------------------------------------------------- */

describe('consentCoverText', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('si la lectura falla, avisa en vez de omitir la línea', async () => {
    const out = await consentCoverText(() => Promise.reject(new Error('tabla ausente')));
    expect(out).toEqual({ text: CONSENT_UNREADABLE_TEXT, missing: true });
  });

  it('si no hay consentimiento guardado, avisa igual', async () => {
    const out = await consentCoverText(() => Promise.resolve(null));
    expect(out).toEqual({ text: CONSENT_UNREADABLE_TEXT, missing: true });
  });

  it('con consentimiento firmado, escribe la constancia', async () => {
    const out = await consentCoverText(() =>
      Promise.resolve({
        signedAt: new Date(2026, 10, 18),
        signerType: 'guardian',
        signerRelation: 'madre',
        signerName: 'Ana Pérez',
        consentVersion: '1.2',
        incapacityReason: null,
      } as never),
    );
    expect(out.missing).toBe(false);
    expect(out.text).toBe('Consentimiento informado v1.2 firmado el 18-11-2026 por Ana Pérez, su madre.');
  });

  it('el texto del aviso es el aprobado', () => {
    expect(CONSENT_UNREADABLE_TEXT).toBe(
      'No se ha podido leer el consentimiento informado de esta evaluación. Compruébelo antes de firmar el informe.',
    );
  });
});
