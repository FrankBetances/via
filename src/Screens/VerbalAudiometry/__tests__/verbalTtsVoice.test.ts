import {
  isUsableSpanishVoice,
  pickBestSpanishVoice,
  pickVoiceForLang,
  scoreSpanishVoice,
  ttsLanguageTagFor,
  TtsVoice,
} from '../verbalTtsVoice';

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

  it('prefiere la voz INSTALADA aunque la de red declare más calidad (caso Google real)', () => {
    // Google TTS: la variante «network» declara quality 500 y la «local» 400.
    // La local debe ganar SIEMPRE: la de red deja la prueba muda sin wifi.
    const voices = [
      V({ id: 'es-es-x-eed-network', language: 'es-ES', quality: 500, networkConnectionRequired: true }),
      V({ id: 'es-es-x-eed-local', language: 'es-ES', quality: 400, networkConnectionRequired: false }),
    ];
    expect(pickBestSpanishVoice(voices)?.id).toBe('es-es-x-eed-local');
  });

  it('una es-ES clásica instalada gana a la neural es-ES de red', () => {
    const voices = [
      V({ id: 'es-es-x-eea-network', language: 'es-ES', quality: 500, networkConnectionRequired: true }),
      V({ id: 'es-ES-language', name: 'Español', language: 'es-ES', quality: 300, networkConnectionRequired: false }),
    ];
    expect(pickBestSpanishVoice(voices)?.id).toBe('es-ES-language');
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

/* -------------------------------------------------------------------------- */
/*  Selección MULTI-IDIOMA (plan Nós: el gallego entra en la audiometría        */
/*  verbal). El dispositivo casi nunca trae voz `gl-*`, así que la cadena de    */
/*  degradación tiene que estar declarada y ser observable: gallego → voz       */
/*  gallega si existe, si no castellana MARCADA como degradación, y nunca la    */
/*  voz por defecto del sistema (inglesa) que invalidaría el estímulo.          */
/* -------------------------------------------------------------------------- */

describe('pickVoiceForLang · una voz por lengua de sesión', () => {
  const ES = V({ id: 'es-es-local', language: 'es-ES', quality: 400, networkConnectionRequired: false });
  const GL = V({ id: 'gl-es-local', language: 'gl-ES', quality: 400, networkConnectionRequired: false });
  const EN = V({ id: 'en-us-local', language: 'en-US', quality: 500, networkConnectionRequired: false });

  it('gallego: usa la voz gallega cuando está instalada (sin degradar)', () => {
    const pick = pickVoiceForLang([EN, ES, GL], 'gl');
    expect(pick?.voice.id).toBe('gl-es-local');
    expect(pick?.langPrefix).toBe('gl');
    expect(pick?.degraded).toBe(false);
  });

  it('gallego sin voz gallega: degrada a la castellana y lo DECLARA', () => {
    const pick = pickVoiceForLang([EN, ES], 'gl');
    expect(pick?.voice.id).toBe('es-es-local');
    expect(pick?.langPrefix).toBe('es');
    expect(pick?.degraded).toBe(true);
  });

  it('nunca cae en la voz inglesa del sistema: sin voz utilizable devuelve null', () => {
    expect(pickVoiceForLang([EN], 'gl')).toBeNull();
    expect(pickVoiceForLang([EN], 'es')).toBeNull();
    expect(pickVoiceForLang([], 'gl')).toBeNull();
    expect(pickVoiceForLang(null, 'es')).toBeNull();
  });

  it('castellano: NO se conforma con una voz gallega (no es su cadena de respaldo)', () => {
    expect(pickVoiceForLang([GL], 'es')).toBeNull();
  });

  it('es-DO usa la cadena del castellano', () => {
    expect(pickVoiceForLang([EN, ES], 'es-DO')?.voice.id).toBe('es-es-local');
  });

  it('dentro de una lengua manda la misma jerarquía (dialecto → sin red → calidad)', () => {
    const glRed = V({ id: 'gl-red', language: 'gl-ES', quality: 500, networkConnectionRequired: true });
    expect(pickVoiceForLang([glRed, GL], 'gl')?.voice.id).toBe('gl-es-local');
  });

  it('la etiqueta de idioma de respaldo es la correcta por lengua', () => {
    expect(ttsLanguageTagFor('gl')).toBe('gl-ES');
    expect(ttsLanguageTagFor('es')).toBe('es-ES');
    expect(ttsLanguageTagFor('es-DO')).toBe('es-DO');
  });
});
