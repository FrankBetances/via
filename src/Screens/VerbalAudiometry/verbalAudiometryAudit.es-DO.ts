import type { AgeBand } from './verbalAudiometryResult';
import { VerbalBandDef } from './verbalAudiometryLists';
import { ES_DO_VERBAL_BANDS } from './verbalAudiometryLists.es-DO';

/* -------------------------------------------------------------------------- */
/*  Auditoría fonética automática del banco para es-DO (Q3.1 · Quisqueya).     */
/*                                                                             */
/*  Marca las láminas cuyo contraste objetivo↔distractor COLAPSA bajo los      */
/*  rasgos del español caribeño/dominicano: si tras plegar esos rasgos la      */
/*  transcripción de un distractor es idéntica a la del objetivo, la lámina    */
/*  deja de medir discriminación auditiva (el niño no puede distinguirlas ni   */
/*  con audición normal) y debe sustituirse en las sesiones Q3.3.              */
/*                                                                             */
/*  Es una TRANSCRIPCIÓN FONOLÓGICA SIMPLIFICADA (sin acento prosódico ni      */
/*  alófonos finos): suficiente para detectar colapsos de par mínimo, que es   */
/*  lo único que se audita por máquina. La decisión clínica es del logopeda.   */
/* -------------------------------------------------------------------------- */

/** Rasgos auditables (plegables de forma independiente para atribuir causa). */
export interface EsDoFeatureFlags {
  /** Seseo: /θ/ no existe (z, ce, ci → s). */
  seseo: boolean;
  /** Yeísmo: ll = y (general también en es peninsular actual). */
  yeismo: boolean;
  /** Aspiración/elisión de /s/ en coda silábica. */
  sCoda: boolean;
  /** Neutralización de líquidas /r/–/l/ en coda (lambdacismo). */
  liquidasCoda: boolean;
  /** Elisión de /d/ intervocálica. */
  dIntervocalica: boolean;
}

export const ES_DO_FEATURES: EsDoFeatureFlags = {
  seseo: true,
  yeismo: true,
  sCoda: true,
  liquidasCoda: true,
  dIntervocalica: true,
};

const NO_FEATURES: EsDoFeatureFlags = {
  seseo: false,
  yeismo: false,
  sCoda: false,
  liquidasCoda: false,
  dIntervocalica: false,
};

const VOWELS = 'aeiou';
const isVowel = (ch: string) => VOWELS.includes(ch);

/**
 * Transcripción fonológica simplificada de una palabra del banco (ortografía
 * es → fonemas aproximados), plegando los rasgos es-DO activados.
 */
export const esDoPhonemic = (word: string, features: EsDoFeatureFlags = ES_DO_FEATURES): string => {
  let w = (word || '')
    .toLowerCase()
    .normalize('NFD')
    // Fuera tildes/diacríticos combinantes, conservando la virgulilla de la ñ.
    .replace(/[̀-ͯ]/g, m => (m === '̃' ? m : ''))
    .normalize('NFC');

  // Ortografía → fonemas (independiente de variante). 'G' es un marcador
  // temporal de /g/ ante e/i («manguera») para que no lo capture la regla
  // g+e/i → /x/ («gente»).
  w = w
    .replace(/ch/g, 'C')
    .replace(/ll/g, features.yeismo ? 'ʝ' : 'ʎ')
    .replace(/rr/g, 'R')
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/gu(?=[ei])/g, 'G')
    .replace(/c(?=[ei])/g, features.seseo ? 's' : 'θ')
    .replace(/z/g, features.seseo ? 's' : 'θ')
    .replace(/c/g, 'k')
    .replace(/g(?=[ei])/g, 'x')
    .replace(/G/g, 'g')
    .replace(/j/g, 'x')
    .replace(/v/g, 'b')
    .replace(/h/g, '')
    .replace(/y(?=[aeiou])/g, 'ʝ')
    .replace(/y/g, 'i')
    .replace(/ñ/g, 'ɲ');

  const chars = [...w];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const prev = chars[i - 1] ?? '';
    const next = chars[i + 1] ?? '';
    const inCoda = !isVowel(ch) && (next === '' || !isVowel(next));

    if (features.dIntervocalica && ch === 'd' && isVowel(prev) && isVowel(next)) {
      continue; // /d/ intervocálica elidida («dedo» → «deo»)
    }
    if (features.sCoda && ch === 's' && inCoda) {
      continue; // /s/ en coda aspirada/elidida («pasta» → «pata», «tos» → «to»)
    }
    if (features.liquidasCoda && (ch === 'r' || ch === 'l') && inCoda) {
      out.push('L'); // líquida en coda neutralizada («puerta» ≈ «puelta»)
      continue;
    }
    out.push(ch);
  }
  return out.join('');
};

/** Lámina en riesgo: un distractor se vuelve indistinguible del objetivo. */
export interface EsDoAuditFinding {
  band: AgeBand;
  itemId: number;
  targetWord: string;
  /** Distractores cuya transcripción es-DO colapsa con la del objetivo. */
  collidesWith: string[];
  /**
   * Rasgo(s) que provocan el colapso (para priorizar la sustitución Q3.3).
   * 'general' = el par ya es homófono en el español base (p. ej. b/v: no es
   * un rasgo dominicano, pero invalida igualmente el contraste auditivo).
   */
  features: (keyof EsDoFeatureFlags | 'general')[];
}

const collisionsOf = (
  target: string,
  distractors: string[],
  features: EsDoFeatureFlags,
): string[] => {
  const t = esDoPhonemic(target, features);
  return distractors.filter(d => esDoPhonemic(d, features) === t);
};

/**
 * Audita el banco (por defecto el es-DO heredado) y devuelve las láminas cuyo
 * contraste colapsa bajo la fonología dominicana, con el rasgo causante.
 */
export const auditEsDoBank = (bands: VerbalBandDef[] = ES_DO_VERBAL_BANDS): EsDoAuditFinding[] => {
  const findings: EsDoAuditFinding[] = [];
  for (const band of bands) {
    for (const item of band.items) {
      const distractors = item.options.map(o => o.word).filter(wd => wd !== item.targetWord);
      const collided = collisionsOf(item.targetWord, distractors, ES_DO_FEATURES);
      if (!collided.length) continue;

      // Atribución de causa: si el par ya colapsa SIN ningún rasgo es-DO, es
      // homofonía del español base ('general'); si no, se busca qué rasgo,
      // activado en solitario, provoca el colapso.
      const baseCollision = collisionsOf(item.targetWord, collided, NO_FEATURES).length > 0;
      const causes: EsDoAuditFinding['features'] = baseCollision
        ? ['general']
        : (Object.keys(ES_DO_FEATURES) as (keyof EsDoFeatureFlags)[]).filter(f => {
            const solo = { ...NO_FEATURES, [f]: true };
            return collisionsOf(item.targetWord, collided, solo).length > 0;
          });

      findings.push({
        band: item.band,
        itemId: item.id,
        targetWord: item.targetWord,
        collidesWith: collided,
        features: causes.length ? causes : ['seseo'],
      });
    }
  }
  return findings;
};
