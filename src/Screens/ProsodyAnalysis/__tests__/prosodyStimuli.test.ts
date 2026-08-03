import { buildVoiceCorpus } from '@/Voice/viaVoiceCorpus';
import { PROSODY_CONSIGNAS } from '@/Voice/viaVoiceConsignas';
import {
  PROSODY_AGE_BANDS,
  PROSODY_STIMULI,
  prosodyConsignaByLang,
  prosodyStimulusById,
  prosodyStimulusFor,
} from '../prosodyStimuli';

/* -------------------------------------------------------------------------- */
/*  Estímulos del módulo de prosodia.                                          */
/*                                                                            */
/*  Lo que se vigila: que el estímulo sea trazable (id versionado), que la     */
/*  lámina tenga de qué hablar —de su riqueza depende que la muestra llegue a  */
/*  los 30 s— y que la consigna llegue al corpus de voz SIN divergir del texto */
/*  que pinta la pantalla (deriva cero).                                       */
/* -------------------------------------------------------------------------- */

describe('PROSODY_STIMULI · trazabilidad', () => {
  it('hay un estímulo por banda de edad y se declara coherente', () => {
    for (const band of PROSODY_AGE_BANDS) {
      const stimulus = prosodyStimulusFor(band);
      expect(stimulus.ageBand).toBe(band);
      expect(stimulus.title.trim().length).toBeGreaterThan(0);
    }
  });

  /* El id va VERSIONADO porque las tomas guardadas apuntan a un estímulo
   * concreto: si la lámina cambia sin cambiar el id, las tomas viejas quedan
   * describiendo un dibujo que ya no existe. */
  it('los ids son únicos y llevan versión', () => {
    const ids = Object.values(PROSODY_STIMULI).map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/-v\d+$/);
  });

  it('se puede recuperar un estímulo por su id', () => {
    for (const stimulus of Object.values(PROSODY_STIMULI)) {
      expect(prosodyStimulusById(stimulus.id)).toBe(stimulus);
    }
    expect(prosodyStimulusById('no-existe')).toBeNull();
  });

  /* Una lámina pobre no sostiene 30 s de habla: el niño la despacha en una
   * frase. El mínimo no es estético, es la duración de la muestra. */
  it('cada lámina declara elementos suficientes para sostener la muestra', () => {
    for (const stimulus of Object.values(PROSODY_STIMULI)) {
      expect(stimulus.elements.length).toBeGreaterThanOrEqual(8);
      const keys = stimulus.elements.map(e => e.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const el of stimulus.elements) expect(el.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('la lámina del lector es secuenciada y la del prelector no', () => {
    // A partir de los siete años la escena estática se agota en pocas frases;
    // la secuencia obliga a encadenar y produce el contorno de cierre.
    expect(prosodyStimulusFor('prelector').panels).toBe(1);
    expect(prosodyStimulusFor('lector').panels).toBeGreaterThan(1);
  });
});

describe('consignas · deriva cero con el corpus de voz', () => {
  it('cada banda tiene consigna en castellano y en dominicano', () => {
    for (const band of PROSODY_AGE_BANDS) {
      const text = prosodyConsignaByLang(band);
      expect(text.es.trim().length).toBeGreaterThan(0);
    }
    for (const spec of PROSODY_CONSIGNAS) {
      expect(spec.text.es.trim().length).toBeGreaterThan(0);
      expect(spec.text['es-DO']).toBe(spec.text.es); // misma lengua, otra voz
    }
  });

  it('el banco de consignas se deriva de la tabla de estímulos', () => {
    expect(PROSODY_CONSIGNAS).toHaveLength(PROSODY_AGE_BANDS.length);
    for (const band of PROSODY_AGE_BANDS) {
      const spec = PROSODY_CONSIGNAS.find(c => c.key === `prosody.${band}`);
      expect(spec).toBeDefined();
      expect(spec!.text.es).toBe(PROSODY_STIMULI[band].consigna.es);
      expect(spec!.style).toBe('tutor');
      expect(spec!.source).toBe('prosodyAnalysis');
    }
  });

  /* Sin esto, la consigna existiría en pantalla pero no en el pipeline de
   * síntesis: saldría con la voz del sistema, distinta en cada dispositivo, y
   * el niño imitaría un modelo distinto en cada exploración. */
  it('las consignas llegan al corpus de voz', () => {
    const corpus = buildVoiceCorpus().filter(e => e.source === 'prosodyAnalysis');
    expect(corpus.length).toBe(PROSODY_AGE_BANDS.length * 2); // es + es-DO

    for (const band of PROSODY_AGE_BANDS) {
      const text = PROSODY_STIMULI[band].consigna.es;
      expect(corpus.some(e => e.lang === 'es' && e.text === text)).toBe(true);
      expect(corpus.some(e => e.lang === 'es-DO' && e.text === text)).toBe(true);
    }
    for (const entry of corpus) expect(entry.style).toBe('tutor');
  });

  it('la consigna pide narrar, no responder sí o no', () => {
    // Una consigna cerrada produce monosílabos, y con monosílabos no hay
    // prosodia que medir.
    for (const band of PROSODY_AGE_BANDS) {
      expect(prosodyConsignaByLang(band).es.toLowerCase()).toContain('cuéntame');
    }
  });
});
