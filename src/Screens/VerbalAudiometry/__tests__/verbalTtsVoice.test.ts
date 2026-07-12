import { isUsableSpanishVoice, pickBestSpanishVoice, scoreSpanishVoice, TtsVoice } from '../verbalTtsVoice';

/* -------------------------------------------------------------------------- */
/*  Selección de la mejor voz española del TTS: castellano y voz neural por    */
/*  encima de una clásica o de otro dialecto; nunca una voz no española.       */
/* -------------------------------------------------------------------------- */

const V = (o: Partial<TtsVoice>): TtsVoice => ({ notInstalled: false, ...o });

describe('isUsableSpanishVoice', () => {
  it('acepta es-* instaladas y rechaza no instaladas o no españolas', () => {
    expect(isUsableSpanishVoice(V({ language: 'es-ES' }))).toBe(true);
    expect(isUsableSpanishVoice(V({ language: 'es-MX' }))).toBe(true);
    expect(isUsableSpanishVoice(V({ language: 'en-US' }))).toBe(false);
    expect(isUsableSpanishVoice(V({ language: 'es-ES', notInstalled: true }))).toBe(false);
  });
});

describe('pickBestSpanishVoice', () => {
  it('elige la voz NEURAL es-ES frente a la clásica es-ES', () => {
    const voices = [
      V({ id: 'es-es-x-eec-local', language: 'es-ES', quality: 400, networkConnectionRequired: false }), // neural
      V({ id: 'es-ES-language', name: 'Español', language: 'es-ES', quality: 400, networkConnectionRequired: false }), // clásica
    ];
    expect(pickBestSpanishVoice(voices)?.id).toBe('es-es-x-eec-local');
  });

  it('prefiere es-ES frente a otro dialecto español aunque tenga algo menos de calidad', () => {
    const voices = [
      V({ id: 'es-mx', language: 'es-MX', quality: 500, networkConnectionRequired: false }),
      V({ id: 'es-es', language: 'es-ES', quality: 400, networkConnectionRequired: false }),
    ];
    expect(pickBestSpanishVoice(voices)?.id).toBe('es-es');
  });

  it('prefiere mayor calidad entre voces equivalentes', () => {
    const voices = [
      V({ id: 'baja', language: 'es-ES', quality: 300, networkConnectionRequired: false }),
      V({ id: 'alta', language: 'es-ES', quality: 500, networkConnectionRequired: false }),
    ];
    expect(pickBestSpanishVoice(voices)?.id).toBe('alta');
  });

  it('en igualdad, desempata por disponibilidad sin red', () => {
    const voices = [
      V({ id: 'red', language: 'es-ES', quality: 400, networkConnectionRequired: true }),
      V({ id: 'local', language: 'es-ES', quality: 400, networkConnectionRequired: false }),
    ];
    expect(pickBestSpanishVoice(voices)?.id).toBe('local');
  });

  it('nunca devuelve una voz no española; null si no hay ninguna', () => {
    expect(pickBestSpanishVoice([V({ language: 'en-US', quality: 500 }), V({ language: 'fr-FR' })])).toBeNull();
    expect(pickBestSpanishVoice([])).toBeNull();
    expect(pickBestSpanishVoice(null)).toBeNull();
  });

  it('una voz neural puntúa por encima de la misma voz sin marcador neural', () => {
    const neural = V({ id: 'es-es-x-eea-network', language: 'es-ES', quality: 400 });
    const plain = V({ id: 'es-es-basic', language: 'es-ES', quality: 400 });
    expect(scoreSpanishVoice(neural)).toBeGreaterThan(scoreSpanishVoice(plain));
  });
});
