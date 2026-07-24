import {
  VOICE_BASE_LANG,
  VOICE_LANGS,
  VOICE_STYLES,
  fnv1a32,
  normalizeVoiceText,
  voiceCorpusId,
  voiceLangPrefix,
} from '../voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Contrato de identidad del corpus de voz. Estos ids son la INVARIANTE        */
/*  compartida entre build y runtime: si esta suite cambia sin querer, los      */
/*  assets ya sintetizados dejan de resolver. Los valores dorados están         */
/*  fijados a propósito (rompen ante cualquier cambio del hash o del formato).  */
/* -------------------------------------------------------------------------- */

describe('normalizeVoiceText', () => {
  it('colapsa blancos y recorta bordes (los espacios no cambian la locución)', () => {
    expect(normalizeVoiceText('  a   b\tc\n ')).toBe('a b c');
    expect(normalizeVoiceText('hola')).toBe('hola');
  });

  it('NO altera el resto del texto (mayúsculas, tildes, signos sí cuentan)', () => {
    expect(normalizeVoiceText('¡Hola, niño!')).toBe('¡Hola, niño!');
  });
});

describe('fnv1a32', () => {
  it('es determinista y de 8 dígitos hex (valores dorados)', () => {
    expect(fnv1a32('a')).toBe('e40c292c');
    expect(fnv1a32('hola mundo')).toBe('5dfaaa76');
    expect(fnv1a32('')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('textos distintos → hashes distintos', () => {
    expect(fnv1a32('casa')).not.toBe(fnv1a32('caza'));
  });
});

describe('voiceLangPrefix', () => {
  it('la base (es) no lleva prefijo; el resto prefija ${lang}_', () => {
    expect(voiceLangPrefix('es')).toBe('');
    expect(voiceLangPrefix('gl')).toBe('gl_');
    expect(voiceLangPrefix('es-DO')).toBe('es-DO_');
  });
});

describe('voiceCorpusId', () => {
  it('formato `[${lang}_]${style}_${hash}_${len}` con valores dorados', () => {
    expect(voiceCorpusId('tutor', 'Hola', 'es')).toBe('tutor_32f29db7_4');
    expect(voiceCorpusId('tutor', 'Hola', 'gl')).toBe('gl_tutor_32f29db7_4');
    expect(voiceCorpusId('clinical', 'Hola', 'es-DO')).toBe('es-DO_clinical_32f29db7_4');
  });

  it('la base (es) es el valor por defecto y NO lleva prefijo (retro-compat)', () => {
    expect(voiceCorpusId('tutor', 'Hola')).toBe(voiceCorpusId('tutor', 'Hola', 'es'));
    expect(VOICE_BASE_LANG).toBe('es');
  });

  it('el estilo forma parte del id (dos estilos = dos ids)', () => {
    expect(voiceCorpusId('tutor', 'Hola', 'es')).not.toBe(voiceCorpusId('slow', 'Hola', 'es'));
  });

  it('la longitud desambigua (mismo hash improbable, distinto len → distinto id)', () => {
    const id = voiceCorpusId('tutor', 'Hola', 'es');
    expect(id.endsWith('_4')).toBe(true);
  });

  it('los espacios de borde/colapsables no cambian el id', () => {
    expect(voiceCorpusId('tutor', '  Hola  ', 'es')).toBe(voiceCorpusId('tutor', 'Hola', 'es'));
    expect(voiceCorpusId('tutor', 'a   b', 'es')).toBe(voiceCorpusId('tutor', 'a b', 'es'));
  });

  it('cada lengua produce un id propio para el mismo texto/estilo', () => {
    const ids = VOICE_LANGS.map(l => voiceCorpusId('tutor', 'Hola', l));
    expect(new Set(ids).size).toBe(VOICE_LANGS.length);
  });

  it('todos los estilos declarados producen un id con el formato esperado', () => {
    for (const style of VOICE_STYLES) {
      expect(voiceCorpusId(style, 'Hola', 'es')).toMatch(/^[a-z]+_[0-9a-f]{8}_\d+$/);
    }
  });
});
