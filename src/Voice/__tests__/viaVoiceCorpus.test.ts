import { VOICE_CONTENT_BANKS } from '../viaVoiceConsignas';
import { buildVoiceCorpus, voiceCorpusStats } from '../viaVoiceCorpus';
import { resolveVoiceAsset, toVoiceLang } from '../viaVoiceResolve';
import { VOICE_ASSETS } from '../viaVoiceAssets';
import { voiceCorpusId } from '../voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Corpus enumerable y resolución de assets. El corpus es el CONTRATO entre    */
/*  la app y la tubería de síntesis: cada entrada debe llevar el id que         */
/*  produce `voiceCorpusId`, no puede haber colisiones y la base `es` debe      */
/*  estar completa.                                                             */
/* -------------------------------------------------------------------------- */

describe('buildVoiceCorpus', () => {
  const corpus = buildVoiceCorpus();

  it('no está vacío y no tiene colisiones de id', () => {
    const stats = voiceCorpusStats(corpus);
    expect(stats.entries).toBeGreaterThan(0);
    expect(stats.collisions).toEqual([]);
  });

  it('el id de cada entrada coincide con voiceCorpusId(style, text, lang) (invariante build↔runtime)', () => {
    for (const e of corpus) {
      expect(e.id).toBe(voiceCorpusId(e.style, e.text, e.lang));
    }
  });

  it('la base `es` enumera TODO el contenido locutable declarado', () => {
    const esEntries = corpus.filter(e => e.lang === 'es');
    expect(esEntries).toHaveLength(VOICE_CONTENT_BANKS.length);
    for (const spec of VOICE_CONTENT_BANKS) {
      expect(esEntries.some(e => e.text === spec.text.es)).toBe(true);
    }
  });

  it('solo enumera una lengua cuando esa lengua tiene texto (sin vacíos)', () => {
    for (const e of corpus) {
      expect(e.text.trim()).not.toBe('');
      expect(VOICE_CONTENT_BANKS.some(s => s.text[e.lang] === e.text)).toBe(true);
    }
  });

  it('las estadísticas cuadran con el nº de entradas', () => {
    const stats = voiceCorpusStats(corpus);
    const sum = Object.values(stats.byLang).reduce((a, b) => a + b, 0);
    expect(sum).toBe(corpus.length);
  });
});

describe('toVoiceLang', () => {
  it('acepta las lenguas conocidas y cae a `es` ante cualquier otra', () => {
    expect(toVoiceLang('es')).toBe('es');
    expect(toVoiceLang('gl')).toBe('gl');
    expect(toVoiceLang('eu')).toBe('eu');
    expect(toVoiceLang('ca')).toBe('ca');
    expect(toVoiceLang('es-419')).toBe('es-419');
    expect(toVoiceLang('es-DO')).toBe('es-DO');
    expect(toVoiceLang('en')).toBe('en');
    expect(toVoiceLang('fr')).toBe('es');
    expect(toVoiceLang(undefined)).toBe('es');
    expect(toVoiceLang(null)).toBe('es');
  });
});

describe('resolveVoiceAsset', () => {
  it('un texto sin asset devuelve null (→ el runtime cae a la voz del sistema)', () => {
    // `VOICE_ASSETS` puede estar vacío (sin síntesis) o poblado por el pipeline;
    // en cualquier caso, un texto que no está en el mapa no resuelve asset.
    const absent = '__texto sin asset sintetizado__';
    expect(VOICE_ASSETS[voiceCorpusId('tutor', absent, 'es')]).toBeUndefined();
    expect(resolveVoiceAsset('tutor', absent, 'es')).toBeNull();
    expect(resolveVoiceAsset('tutor', absent, 'gl')).toBeNull();
  });

  it('resuelve el asset propio de la lengua cuando existe', () => {
    const glId = voiceCorpusId('tutor', 'Hola', 'gl');
    const esId = voiceCorpusId('tutor', 'Hola', 'es');
    try {
      VOICE_ASSETS[esId] = 111;
      VOICE_ASSETS[glId] = 222;
      expect(resolveVoiceAsset('tutor', 'Hola', 'gl')).toBe(222);
      expect(resolveVoiceAsset('tutor', 'Hola', 'es')).toBe(111);
    } finally {
      delete VOICE_ASSETS[glId];
      delete VOICE_ASSETS[esId];
    }
  });

  it('un IDIOMA COMPLETO sin asset propio NO cae al recorte castellano', () => {
    // Éste es el cableado que estaba mal. Con la cadena anterior, una sesión
    // gallega sin recorte gallego reproducía el recorte CASTELLANO y lo
    // presentaba como gallego: locución y tarjeta en lenguas distintas. Un
    // idioma completo o suena en su lengua o no suena en ella; devolver `null`
    // hace que el runtime dicte con la voz del sistema de ESA lengua.
    const esId = voiceCorpusId('tutor', 'Hola', 'es');
    try {
      VOICE_ASSETS[esId] = 111; // solo hay asset castellano
      expect(resolveVoiceAsset('tutor', 'Hola', 'gl')).toBeNull();
      expect(resolveVoiceAsset('tutor', 'Hola', 'eu')).toBeNull();
    } finally {
      delete VOICE_ASSETS[esId];
    }
  });

  it('una VARIANTE sí hereda el recorte de su base (mismo idioma, otro acento)', () => {
    // es-DO es español: reproducir el recorte peninsular de una palabra que
    // todavía no tiene locución dominicana degrada el ACENTO, no el idioma.
    const esId = voiceCorpusId('tutor', 'Hola', 'es');
    const doId = voiceCorpusId('tutor', 'Hola', 'es-DO');
    try {
      VOICE_ASSETS[esId] = 111;
      expect(resolveVoiceAsset('tutor', 'Hola', 'es-DO')).toBe(111);
      VOICE_ASSETS[doId] = 333; // con locución propia, manda la suya
      expect(resolveVoiceAsset('tutor', 'Hola', 'es-DO')).toBe(333);
    } finally {
      delete VOICE_ASSETS[esId];
      delete VOICE_ASSETS[doId];
    }
  });
});
