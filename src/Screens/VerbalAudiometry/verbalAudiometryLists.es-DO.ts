import { assetKeyForWord, VERBAL_BANDS, VerbalBandDef, VerbalItem } from './verbalAudiometryLists';

/* -------------------------------------------------------------------------- */
/*  Banco de estímulos de la variante es-DO («Quisqueya Habla»).               */
/*                                                                             */
/*  A diferencia del gallego (banco nuevo desde cero, plan Nós M3), la         */
/*  variante dominicana es una AUDITORÍA Y SUSTITUCIÓN SELECTIVA del banco     */
/*  español (plan Quisqueya Habla, Q3): se hereda cada lámina de `es` y solo   */
/*  se sustituyen las que dependan de contrastes inestables en el español      */
/*  caribeño (seseo, /s/ en coda aspirada/elidida, líquidas en coda            */
/*  neutralizadas, /d/ intervocálica elidida).                                 */
/*                                                                             */
/*  Las sustituciones se declaran en ES_DO_ITEM_OVERRIDES y las decide el      */
/*  logopeda dominicano en las sesiones Q3.3 (firma en                         */
/*  docs/design/audiometria-verbal-es-do.md). Hoy la lista está VACÍA: la      */
/*  variante existe estructuralmente (Q1) con contenido idéntico al español    */
/*  base, tal como exige el plan antes de la revisión fonética.                */
/*                                                                             */
/*  Assets: el audio es SIEMPRE propio de la variante (misma clave, voz        */
/*  es-DO en assets/audio/verbal/es-DO/) y las ilustraciones se heredan de     */
/*  `es` salvo que la sustitución introduzca palabras nuevas (Q1.3/Q4.1).      */
/* -------------------------------------------------------------------------- */

export interface VerbalItemOverride {
  /** id (global y estable) del ítem del banco base que se sustituye. */
  id: number;
  /** [objetivo, ...distractores] — misma aridad que la lámina original. */
  words: string[];
  /** Rasgo fonológico es-DO que motiva la sustitución (trazabilidad Q3.3). */
  reason: string;
}

/**
 * Sustituciones firmadas por el logopeda dominicano (Q3.3). Vacío hasta la
 * revisión fonética: NO añadir láminas aquí sin la firma clínica en
 * `docs/design/audiometria-verbal-es-do.md`.
 */
export const ES_DO_ITEM_OVERRIDES: VerbalItemOverride[] = [];

const applyOverride = (item: VerbalItem, ov: VerbalItemOverride): VerbalItem => {
  if (ov.words.length !== item.options.length) {
    throw new Error(
      `Override es-DO del ítem ${item.id}: ${ov.words.length} palabras para una lámina de ${item.options.length} opciones`,
    );
  }
  const withImages = item.options.some(o => !!o.image);
  return {
    ...item,
    targetWord: ov.words[0],
    audio: assetKeyForWord(ov.words[0]),
    options: ov.words.map(word => ({
      word,
      ...(withImages ? { image: assetKeyForWord(word) } : {}),
    })),
  };
};

/**
 * Aplica una lista de sustituciones sobre el banco base (exportada para poder
 * probar la semántica de la fusión sin poblar ES_DO_ITEM_OVERRIDES).
 */
export const buildEsDoBands = (
  overrides: readonly VerbalItemOverride[] = ES_DO_ITEM_OVERRIDES,
): VerbalBandDef[] => {
  const byId = new Map(overrides.map(ov => [ov.id, ov]));
  if (byId.size !== overrides.length) {
    throw new Error('Overrides es-DO con id duplicado');
  }
  return VERBAL_BANDS.map(band => ({
    ...band,
    items: band.items.map(item => {
      const ov = byId.get(item.id);
      return ov ? applyOverride(item, ov) : item;
    }),
  }));
};

/**
 * Banco completo es-DO: mismas bandas, ids y estructura que `es`, con las
 * láminas sustituidas por ES_DO_ITEM_OVERRIDES (hoy ninguna).
 */
export const ES_DO_VERBAL_BANDS: VerbalBandDef[] = buildEsDoBands();
