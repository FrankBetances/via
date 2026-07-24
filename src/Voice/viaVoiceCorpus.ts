import { CONSIGNAS } from './viaVoiceConsignas';
import { VOICE_LANGS, VoiceLang, VoiceStyle, voiceCorpusId } from './voiceCorpusId';

/* -------------------------------------------------------------------------- */
/*  Definición del CORPUS de voz (contrato serializable · lógica PURA).         */
/*                                                                             */
/*  Enumera TODAS las cadenas locutables como entradas {id, lang, style, text,  */
/*  source}. Es el CONTRATO entre la app y la tubería de síntesis: el           */
/*  exportador (`scripts/export-voice-corpus.js`) lo compila y vuelca a         */
/*  `voice-corpus.json`; el generador de assets sintetiza SOLO lo que falta; y  */
/*  el runtime resuelve el mismo id contra el mapa de assets.                   */
/*                                                                             */
/*  MÓDULO PURO (P7): no importa RN/UI. Un script de Node debe poder            */
/*  compilarlo y ejecutarlo; si deja de ser puro, el exportador falla en        */
/*  build-time, nunca en la app.                                                */
/* -------------------------------------------------------------------------- */

export interface VoiceCorpusEntry {
  /** Id estable = `voiceCorpusId(style, text, lang)`. */
  id: string;
  lang: VoiceLang;
  style: VoiceStyle;
  /** Texto EXACTO a locutar (mirror del que dicta la pantalla). */
  text: string;
  /** Banco de contenido de origen. */
  source: string;
}

/**
 * Construye el corpus completo recorriendo cada banco de contenido por lengua.
 * Solo emite una entrada cuando la lengua tiene texto para esa consigna (una
 * lengua sin localizar no genera entradas: en runtime cae a la voz del
 * sistema). El idioma base `es` siempre está presente.
 */
export const buildVoiceCorpus = (): VoiceCorpusEntry[] => {
  const entries: VoiceCorpusEntry[] = [];
  for (const spec of CONSIGNAS) {
    for (const lang of VOICE_LANGS) {
      const text = spec.text[lang];
      if (typeof text !== 'string' || text.trim() === '') continue;
      entries.push({
        id: voiceCorpusId(spec.style, text, lang),
        lang,
        style: spec.style,
        text,
        source: spec.source,
      });
    }
  }
  return entries;
};

export interface VoiceCorpusStats {
  entries: number;
  byLang: Record<string, number>;
  byStyle: Record<string, number>;
  bySource: Record<string, number>;
  /** Ids que colisionan (mismo id, texto/estilo distinto): DEBE estar vacío. */
  collisions: string[];
}

/** Estadísticas y detección de colisiones de id (aborta el export si las hay). */
export const voiceCorpusStats = (entries: VoiceCorpusEntry[]): VoiceCorpusStats => {
  const byLang: Record<string, number> = {};
  const byStyle: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const seen = new Map<string, string>(); // id → firma texto|estilo|lang
  const collisions = new Set<string>();
  for (const e of entries) {
    byLang[e.lang] = (byLang[e.lang] ?? 0) + 1;
    byStyle[e.style] = (byStyle[e.style] ?? 0) + 1;
    bySource[e.source] = (bySource[e.source] ?? 0) + 1;
    const sig = `${e.lang}|${e.style}|${e.text}`;
    const prev = seen.get(e.id);
    if (prev != null && prev !== sig) collisions.add(e.id);
    else seen.set(e.id, sig);
  }
  return {
    entries: entries.length,
    byLang,
    byStyle,
    bySource,
    collisions: [...collisions].sort(),
  };
};
