import { ES_DO_FEATURES, auditEsDoBank, esDoPhonemic } from '../verbalAudiometryAudit.es-DO';
import { buildEsDoBands } from '../verbalAudiometryLists.es-DO';

/* -------------------------------------------------------------------------- */
/*  Auditoría fonética automática es-DO (Q3.1 · Quisqueya Habla).              */
/*                                                                             */
/*  Fija por máquina: (1) la transcripción simplificada pliega los rasgos      */
/*  caribeños correctos; (2) el informe del banco heredado es ESTABLE — si     */
/*  una edición del banco introduce una lámina nueva cuyo contraste colapsa    */
/*  en es-DO, este test la canta en CI (regla Q3.4 sobre lo verificable por    */
/*  máquina; la decisión clínica sigue siendo del logopeda en Q3.3).           */
/* -------------------------------------------------------------------------- */

describe('esDoPhonemic · transcripción simplificada', () => {
  it('pliega los rasgos es-DO documentados en el plan', () => {
    // Seseo: z / c(e,i) → s.
    expect(esDoPhonemic('loza')).toBe(esDoPhonemic('losa'));
    expect(esDoPhonemic('cebolla')).toBe(esDoPhonemic('sebolla'));
    // Aspiración/elisión de /s/ en coda («tos» → «to», «pasta» → «pata»).
    expect(esDoPhonemic('tos')).toBe('to');
    expect(esDoPhonemic('pasta')).toBe(esDoPhonemic('pata'));
    // Neutralización de líquidas en coda («puerta» ≈ «puelta»).
    expect(esDoPhonemic('puerta')).toBe(esDoPhonemic('puelta'));
    // Elisión de /d/ intervocálica («dedo» → «deo»).
    expect(esDoPhonemic('dedo')).toBe(esDoPhonemic('deo'));
    // Yeísmo: ll = y.
    expect(esDoPhonemic('callo')).toBe(esDoPhonemic('cayo'));
  });

  it('no pliega contrastes estables (oclusivas en ataque, nasales, vocales)', () => {
    expect(esDoPhonemic('pato')).not.toBe(esDoPhonemic('gato'));
    expect(esDoPhonemic('mano')).not.toBe(esDoPhonemic('mono'));
    expect(esDoPhonemic('boca')).not.toBe(esDoPhonemic('foca'));
    // r/l intervocálicas (no coda) siguen distinguiéndose.
    expect(esDoPhonemic('mora')).not.toBe(esDoPhonemic('mola'));
    // rr/r intervocálicas también.
    expect(esDoPhonemic('pero')).not.toBe(esDoPhonemic('perro'));
  });

  it('respeta la ortografía → fonema del español (qu, gu+e/i, g+e/i, h muda)', () => {
    expect(esDoPhonemic('queso')).toBe('keso');
    expect(esDoPhonemic('manguera')).toContain('g'); // /g/, no /x/
    expect(esDoPhonemic('higo', { ...ES_DO_FEATURES, sCoda: false })).toBe('igo');
    expect(esDoPhonemic('hijo')).toBe('ixo');
  });
});

describe('auditEsDoBank · informe del banco heredado (Q3.1)', () => {
  const findings = auditEsDoBank();

  it('detecta el colapso por yeísmo «callo» ≈ «cayo» (banda D)', () => {
    const f = findings.find(x => x.targetWord === 'callo');
    expect(f).toBeTruthy();
    expect(f!.band).toBe('D');
    expect(f!.collidesWith).toEqual(['cayo']);
    expect(f!.features).toEqual(['yeismo']);
  });

  it('detecta la homofonía general «vaca» ≈ «baca» (b/v, ya en español base)', () => {
    const f = findings.find(x => x.targetWord === 'vaca');
    expect(f).toBeTruthy();
    expect(f!.collidesWith).toEqual(['baca']);
    expect(f!.features).toEqual(['general']);
  });

  it('el informe del banco heredado es estable: exactamente estas 2 láminas', () => {
    // Si esto rompe, o bien se editó el banco introduciendo un contraste que
    // colapsa en es-DO (revisar con el logopeda antes de mergear), o bien las
    // sustituciones Q3.3 resolvieron una lámina (actualizar el recuento).
    expect(findings.map(f => ({ id: f.itemId, target: f.targetWord }))).toEqual([
      { id: 30, target: 'callo' },
      { id: 37, target: 'vaca' },
    ]);
  });

  it('una sustitución Q3.3 con par estable elimina el hallazgo', () => {
    const bands = buildEsDoBands([
      {
        id: 30,
        words: ['gallo', 'mayo', 'rayo', 'fallo', 'tallo', 'bayo'],
        reason: 'ensayo: elimina el par callo/cayo (homófono por yeísmo)',
      },
    ]);
    const after = auditEsDoBank(bands);
    expect(after.find(x => x.itemId === 30)).toBeUndefined();
  });
});
