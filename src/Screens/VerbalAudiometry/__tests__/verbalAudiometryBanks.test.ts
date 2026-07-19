import {
  collectLangAssetInventory,
  getVerbalBands,
  VERBAL_BANK_BASE,
  VERBAL_BANK_LANGS,
} from '../verbalAudiometryBanks';
import { buildEsDoBands, ES_DO_ITEM_OVERRIDES } from '../verbalAudiometryLists.es-DO';
import { collectAssetInventory, VERBAL_BANDS } from '../verbalAudiometryLists';

/* -------------------------------------------------------------------------- */
/*  Selector multi-idioma del banco verbal (infra M1/Q1 · Quisqueya Habla).    */
/*                                                                             */
/*  Verifica: registro de idiomas, herencia es-DO → es (contenido idéntico     */
/*  hasta la revisión fonética Q3), semántica de la sustitución selectiva y    */
/*  coherencia del inventario de assets con el motor de voz neural            */
/*  (tools/nos/voices.json).                                                   */
/* -------------------------------------------------------------------------- */

/* Globals de Node que Jest provee (el proyecto no incluye @types/node). */
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('getVerbalBands · registro por idioma', () => {
  it('es devuelve el banco base (misma referencia, sin copia divergente)', () => {
    expect(getVerbalBands('es')).toBe(VERBAL_BANDS);
  });

  it('es-DO existe estructuralmente y hereda del español base (Q1.3)', () => {
    const esDo = getVerbalBands('es-DO');
    expect(esDo).toHaveLength(VERBAL_BANDS.length);
    for (let i = 0; i < esDo.length; i++) {
      const base = VERBAL_BANDS[i];
      const variant = esDo[i];
      expect(variant.band).toBe(base.band);
      expect(variant.modality).toBe(base.modality);
      expect(variant.optionsPerCard).toBe(base.optionsPerCard);
      // ids globales estables: la variante nunca renumera.
      expect(variant.items.map(it => it.id)).toEqual(base.items.map(it => it.id));
      // Sin overrides firmados (Q3.3 pendiente), el contenido es idéntico.
      expect(variant.items).toEqual(base.items);
    }
    expect(ES_DO_ITEM_OVERRIDES).toHaveLength(0);
  });

  it('un idioma sin banco registrado falla explícitamente (gl llega con M3)', () => {
    expect(() => getVerbalBands('gl')).toThrow(/no registrado/);
    expect(() => getVerbalBands('fr')).toThrow(/no registrado/);
  });

  it('todo idioma registrado declara su base de herencia', () => {
    for (const lang of VERBAL_BANK_LANGS) {
      expect(VERBAL_BANK_BASE[lang] !== undefined).toBe(true);
      const base = VERBAL_BANK_BASE[lang];
      if (base) expect(VERBAL_BANK_LANGS).toContain(base);
    }
  });
});

describe('buildEsDoBands · semántica de la sustitución selectiva (Q3)', () => {
  // Lámina real de la banda C (pares mínimos con imagen) para el ensayo.
  const sample = VERBAL_BANDS.find(b => b.band === 'C')!.items[1];

  it('una sustitución reemplaza palabras y claves de asset conservando id/banda/práctica', () => {
    const words = ['perro', 'cerro', 'berro', 'gorro', 'morro', 'forro'];
    const bands = buildEsDoBands([{ id: sample.id, words, reason: 'ensayo de fusión' }]);
    const item = bands.flatMap(b => b.items).find(it => it.id === sample.id)!;
    expect(item.targetWord).toBe('perro');
    expect(item.audio).toBe('perro');
    expect(item.band).toBe(sample.band);
    expect(!!item.practice).toBe(!!sample.practice);
    expect(item.options.map(o => o.word)).toEqual(words);
    // La lámina base tenía imágenes → la sustituta también (claves nuevas propias).
    expect(item.options.every(o => !!o.image)).toBe(true);
    // El resto del banco queda intacto.
    const untouched = bands.flatMap(b => b.items).filter(it => it.id !== sample.id);
    const baseUntouched = VERBAL_BANDS.flatMap(b => b.items).filter(it => it.id !== sample.id);
    expect(untouched).toEqual(baseUntouched);
  });

  it('rechaza sustituciones malformadas (aridad distinta o id duplicado)', () => {
    expect(() =>
      buildEsDoBands([{ id: sample.id, words: ['perro', 'cerro'], reason: 'aridad inválida' }]),
    ).toThrow(/opciones/);
    const words = ['perro', 'cerro', 'berro', 'gorro', 'morro', 'forro'];
    expect(() =>
      buildEsDoBands([
        { id: sample.id, words, reason: 'duplicado' },
        { id: sample.id, words, reason: 'duplicado' },
      ]),
    ).toThrow(/duplicado/);
  });
});

describe('inventario de assets por idioma (Q1.4)', () => {
  it('es: coincide con el inventario histórico y no hereda nada', () => {
    const inv = collectLangAssetInventory('es');
    const legacy = collectAssetInventory();
    expect(inv.audio).toEqual(legacy.audio);
    expect(inv.images).toEqual(legacy.images);
    expect(inv.inheritedImages).toEqual([]);
  });

  it('es-DO: audio propio (misma clave, voz dominicana) e imágenes 100 % heredables hoy', () => {
    const inv = collectLangAssetInventory('es-DO');
    const base = collectLangAssetInventory('es');
    expect(inv.audio).toEqual(base.audio);
    expect(inv.images).toEqual(base.images);
    // Sin overrides, toda ilustración se hereda de es sin duplicar archivos.
    expect(inv.inheritedImages).toEqual(inv.images);
  });
});

describe('coherencia con el motor de voz neural (tools/nos/voices.json)', () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'tools', 'nos', 'voices.json'), 'utf8'),
  );

  it('todo idioma con banco registrado tiene una voz neural declarada', () => {
    for (const lang of VERBAL_BANK_LANGS) {
      expect({ lang, voice: !!registry.voices[lang] }).toEqual({ lang, voice: true });
    }
  });

  it('las voces declaran motor conocido, modelo y estado provisional explícito', () => {
    for (const [lang, cfg] of Object.entries<any>(registry.voices)) {
      expect({ lang, engine: ['piper', 'coqui-vits'].includes(cfg.engine) }).toEqual({ lang, engine: true });
      expect(typeof cfg.model).toBe('string');
      expect(typeof cfg.provisional).toBe('boolean');
      expect(typeof cfg.source).toBe('string');
    }
  });

  it('gl (plan Nós) tiene la voz Celtia registrada aunque su banco aún no exista', () => {
    expect(registry.voices.gl.model).toBe('proxectonos/Nos_TTS-celtia-vits-graphemes');
    expect(registry.voices.gl.engine).toBe('coqui-vits');
  });
});
