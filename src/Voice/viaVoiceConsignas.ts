/* Ruta RELATIVA, no alias `@/`: `scripts/export-voice-corpus.js` compila este
   módulo de forma aislada con `tsc`, sin los `paths` del tsconfig, y un alias
   aquí rompe la exportación del corpus y con ella toda la cadena de síntesis. */
import { TAR_LEXICON } from '../Screens/Articulation/articulationLexicon';
import { buildArticulationItems } from '../Screens/Articulation/articulationResult';
import {
  PROSODY_AGE_BANDS,
  prosodyStimulusFor,
} from '../Screens/ProsodyAnalysis/prosodyStimuli';
import {
  EF_DOMAIN_META,
  EF_DOMAIN_ORDER,
  EF_RULES,
  efRuleChangeText,
  efRuleIntroText,
  type EfRule,
} from '../Screens/ExecutiveFunctions/executiveFunctionsGame';

import { bankLangs } from './viaVoiceLocale';
import type { VoiceLang, VoiceStyle } from './voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Banco de CONSIGNAS locutables (contenido enumerable · lógica PURA).         */
/*                                                                             */
/*  Fuente ÚNICA y FINITA de las frases habladas fijas de la app (P3 del        */
/*  blueprint): las consignas que hoy dicta el TTS del sistema y que el         */
/*  pipeline puede pre-sintetizar con voz neuronal por lengua. Cada consigna    */
/*  declara su texto POR LENGUA con la MISMA interfaz (P5):                     */
/*    · `es`    — castellano, SIEMPRE presente (idioma base);                   */
/*    · `gl`    — gallego, delta REVISADO (plan Nós M2 · Nos_MT + revisión);    */
/*    · `es-DO` — dominicano, delta REVISADO (Quisqueya Habla Q2 · glosario).   */
/*                                                                             */
/*  Una lengua sin texto para una consigna NO se enumera para esa lengua: en   */
/*  runtime la consigna cae a la voz del sistema (degradación elegante, P2).   */
/*  Nada de traducción automática entra aquí sin revisión humana firmada (P6). */
/*                                                                             */
/*  DERIVA CERO (P3): las consignas de los mini-juegos de Funciones            */
/*  Ejecutivas se derivan de `EF_DOMAIN_META` — la MISMA tabla que dicta la     */
/*  pantalla (`${game}. ${instruction}`) — de modo que corpus y pantalla no    */
/*  pueden divergir. Si un literal cambia en la tabla, cambia el id y el asset  */
/*  se regenera (o cae a la voz del sistema hasta regenerar).                   */
/* -------------------------------------------------------------------------- */

/** Texto de una consigna por lengua (la base `es` es obligatoria). */
export type ConsignaText = Partial<Record<VoiceLang, string>> & { es: string };

export interface ConsignaSpec {
  /** Clave estable de trazabilidad (documenta el origen; NO es el id de voz). */
  key: string;
  /** Banco de contenido de origen (para estadísticas del corpus). */
  source: string;
  /** Prosodia horneada en el audio. */
  style: VoiceStyle;
  /** Texto por lengua. */
  text: ConsignaText;
}

/** Consigna hablada de un mini-juego: mismo string que dicta la pantalla. */
export const efConsignaText = (game: string, instruction: string): string =>
  `${game}. ${instruction}`;

/**
 * Localización REVISADA de las consignas de Funciones Ejecutivas por dominio.
 * Incorpora adaptaciones para gallego (gl) y euskera (eu) y dominicano (es-DO).
 */
export const EF_CONSIGNA_L10N: Partial<
  Record<(typeof EF_DOMAIN_ORDER)[number], Partial<Record<Exclude<VoiceLang, 'es'>, string>>>
> = {
  attention: {
    'es-DO': 'Busca y encuentra. ¡Toca TODOS los gatitos que veas, lo más rápido que puedas!',
    gl: 'Busca e atopa. Toca TODOS os gatiños que vexas, o máis rápido que poidas!',
    eu: 'Bilatu eta aurkitu. Ukitu ikusten dituzun katu GUZTIAK, ahalik eta azkarren!',
  },
  inhibition: {
    'es-DO': 'No despiertes al lobo. Toca cada animal que aparezca… ¡pero NUNCA toques al lobo, que está dormido!',
    gl: 'Non espertes o lobo. Toca cada animal que apareza… pero NUNCA toques o lobo, que está durmido!',
    eu: 'Ez esnatu otsoa. Ukitu agertzen den animalia bakoitza… baina INOIZ ez ukitu otsoa, lo dago eta!',
  },
  flexibility: {
    'es-DO': 'El juego de las normas. Mira la tarjeta y tócala donde toque según la norma. ¡Atención, la norma cambia!',
    gl: 'O xogo das normas. Mira a tarxeta e tócaa onde corresponda segundo a norma. Atención, a norma cambia!',
    eu: 'Arauen jokoa. Begiratu txartela eta ukitu arauaren arabera dagokion lekuan. Kontuz, araua aldatu egiten da!',
  },
  workingMemory: {
    'es-DO': 'El loro repetidor. Mira qué tarjetas se encienden y repite la secuencia tocándolas en el mismo orden.',
    gl: 'O papagaio repetidor. Mira que tarxetas se acenden e repite a secuencia tocándoas na mesma orde.',
    eu: 'Loro errepikatzailea. Begiratu zein txartel pizten diren eta errepikatu sekuentzia ordena berean ukituz.',
  },
  planning: {
    'es-DO': 'Ordena la historia. Estas tarjetas están desordenadas: tócalas en el orden correcto de la historia.',
    gl: 'Ordena a historia. Estas tarxetas están desordenadas: tócalas na orde correcta da historia.',
    eu: 'Ordenatu istorioa. Txartel hauek desordenatuta daude: ukitu istorioaren ordena egokian.',
  },
};

/** Banco de consignas de la batería (los 5 mini-juegos de FE). */
export const CONSIGNAS: ConsignaSpec[] = EF_DOMAIN_ORDER.map(domain => {
  const meta = EF_DOMAIN_META[domain];
  const l10n = EF_CONSIGNA_L10N[domain] ?? {};
  const es = efConsignaText(meta.game, meta.instruction);
  const text: ConsignaText = { es, 'es-DO': l10n['es-DO'] ?? es };
  if (l10n.gl) text.gl = l10n.gl;
  if (l10n.eu) text.eu = l10n.eu;
  return { key: `ef.${domain}`, source: 'executiveFunctions', style: 'tutor', text };
});

/**
 * Anuncios de norma del juego de flexibilidad (DCCS) en las 4 lenguas.
 */
const EF_RULE_L10N: Record<EfRule, { change: Record<VoiceLang, string>; intro: Record<VoiceLang, string> }> = {
  color: {
    change: {
      es: efRuleChangeText('color'),
      'es-DO': efRuleChangeText('color'),
      gl: '¡Atención! A norma cambiou: agora xógase por cor.',
      eu: 'Kontuz! Araua aldatu da: orain kolorearen arabera jolasten da.',
    },
    intro: {
      es: efRuleIntroText('color'),
      'es-DO': efRuleIntroText('color'),
      gl: 'Xógase por cor.',
      eu: 'Kolorearen arabera jolasten da.',
    },
  },
  forma: {
    change: {
      es: efRuleChangeText('forma'),
      'es-DO': efRuleChangeText('forma'),
      gl: '¡Atención! A norma cambiou: agora xógase por forma.',
      eu: 'Kontuz! Araua aldatu da: orain formaren arabera jolasten da.',
    },
    intro: {
      es: efRuleIntroText('forma'),
      'es-DO': efRuleIntroText('forma'),
      gl: 'Xógase por forma.',
      eu: 'Formaren arabera jolasten da.',
    },
  },
};

export const EF_RULE_CONSIGNAS: ConsignaSpec[] = EF_RULES.flatMap(rule =>
  (
    [
      [`ef.rule.change.${rule}`, EF_RULE_L10N[rule].change],
      [`ef.rule.intro.${rule}`, EF_RULE_L10N[rule].intro],
    ] as const
  ).map(([key, text]) => ({
    key,
    source: 'executiveFunctions',
    style: 'tutor' as VoiceStyle,
    text: text as ConsignaText,
  })),
);

/**
 * Modelos hablados del T.A.R. (Test de Articulación a la Repetición).
 */
export const TAR_MODELS: ConsignaSpec[] = [
  ...new Set(buildArticulationItems().map(item => item.word)),
].map(word => ({
  key: `tar.${word}`,
  source: 'articulation',
  style: 'tutor' as VoiceStyle,
  text: tarModelByLang(word),
}));

/**
 * Todos los bancos de contenido locutable de la app. `buildVoiceCorpus` los
 * recorre en orden; añadir un banco nuevo aquí lo incorpora al corpus, al
 * pipeline de síntesis y a los tests de invariantes sin tocar nada más.
 */
/**
 * Consignas del módulo de PROSODIA (una por banda de edad).
 */
export const PROSODY_CONSIGNAS: ConsignaSpec[] = PROSODY_AGE_BANDS.map(band => {
  const stimulus = prosodyStimulusFor(band);
  const es = stimulus.consigna.es;
  const text: ConsignaText = { es, 'es-DO': stimulus.consigna['es-DO'] ?? es };
  if (stimulus.consigna.gl) text.gl = stimulus.consigna.gl;
  if (stimulus.consigna.eu) text.eu = stimulus.consigna.eu;
  return { key: `prosody.${band}`, source: 'prosodyAnalysis', style: 'tutor' as VoiceStyle, text };
});

export const VOICE_CONTENT_BANKS: ConsignaSpec[] = [
  ...CONSIGNAS,
  ...EF_RULE_CONSIGNAS,
  ...TAR_MODELS,
  ...PROSODY_CONSIGNAS,
];

/* -------------------------------------------------------------------------- */
/*  Consulta de los bancos desde las pantallas.                                 */
/* -------------------------------------------------------------------------- */

/** Consigna hablada de un mini-juego de FE, por lengua (DERIVA CERO). */
export const efConsignaByLang = (domain: (typeof EF_DOMAIN_ORDER)[number]): ConsignaText => {
  const spec = CONSIGNAS.find(c => c.key === `ef.${domain}`);
  if (spec) return spec.text;
  const meta = EF_DOMAIN_META[domain];
  return { es: efConsignaText(meta.game, meta.instruction) };
};

/** Anuncio de norma del juego de flexibilidad, por lengua (DERIVA CERO). */
export const efRuleConsignaByLang = (rule: EfRule, changed: boolean): ConsignaText => {
  const key = `ef.rule.${changed ? 'change' : 'intro'}.${rule}`;
  const spec = EF_RULE_CONSIGNAS.find(c => c.key === key);
  if (spec) return spec.text;
  const es = changed ? efRuleChangeText(rule) : efRuleIntroText(rule);
  return { es, 'es-DO': es };
};

/** Modelo hablado del T.A.R. para una palabra, por lengua (DERIVA CERO). */
/**
 * Modelo hablado del T.A.R. en cada variedad.
 *
 * NO es una traducción: cada columna conserva el fonema diana en su posición
 * silábica (ver `articulationLexicon`). Devolver la palabra castellana
 * etiquetada como `gl` haría que una voz galega pronunciase texto castellano,
 * y el niño imitaría un modelo fonético que no es el de su lengua.
 */
/* Declaración de función, no `const`: `TAR_MODELS` la invoca en la evaluación
   del módulo, que ocurre ANTES de esta línea. Con una arrow function quedaba
   en la zona muerta temporal y el corpus entero fallaba al cargarse. */
export function tarModelByLang(word: string): ConsignaText {
  const entry = TAR_LEXICON[word];
  // Sin entrada no se inventa una variedad: se declara solo el castellano y
  // `bankLangs` retirará del selector la lengua que quede incompleta.
  if (!entry) return { es: word, 'es-DO': word };
  return { es: word, 'es-DO': entry['es-DO'], gl: entry.gl, eu: entry.eu };
}

/**
 * Lenguas que cada banco puede ofrecer en su selector.
 */
export const EF_CONSIGNA_LANGS: VoiceLang[] = bankLangs(
  [...CONSIGNAS, ...EF_RULE_CONSIGNAS].map(c => c.text),
);
export const TAR_MODEL_LANGS: VoiceLang[] = bankLangs(TAR_MODELS.map(c => c.text));

/** Consigna hablada del módulo de prosodia, por lengua (DERIVA CERO). */
export const prosodyConsignaTextByLang = (band: 'prelector' | 'lector'): ConsignaText => {
  const spec = PROSODY_CONSIGNAS.find(c => c.key === `prosody.${band}`);
  if (spec) return spec.text;
  const es = prosodyStimulusFor(band).consigna.es;
  return { es, 'es-DO': es };
};

/** Lenguas que el selector del módulo de prosodia puede ofrecer sin mentir. */
export const PROSODY_CONSIGNA_LANGS: VoiceLang[] = bankLangs(PROSODY_CONSIGNAS.map(c => c.text));
