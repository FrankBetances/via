import { EF_DOMAIN_META, EF_DOMAIN_ORDER } from '../Screens/ExecutiveFunctions/executiveFunctionsGame';

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
 * Vacío hasta que el revisor lingüístico (gl) / dominicano (es-DO) firme el
 * delta; entonces cada entrada añade `${game}. ${instruction}` ya localizado y
 * el pipeline sintetiza su asset. Estructura preparada, contenido pendiente.
 */
export const EF_CONSIGNA_L10N: Partial<
  Record<(typeof EF_DOMAIN_ORDER)[number], Partial<Record<Exclude<VoiceLang, 'es'>, string>>>
> = {
  // attention:   { gl: '…', 'es-DO': '…' },
  // inhibition:  { gl: '…', 'es-DO': '…' },
  // …
};

/** Banco de consignas de la batería (hoy: los 5 mini-juegos de FE). */
export const CONSIGNAS: ConsignaSpec[] = EF_DOMAIN_ORDER.map(domain => {
  const meta = EF_DOMAIN_META[domain];
  const l10n = EF_CONSIGNA_L10N[domain] ?? {};
  const text: ConsignaText = { es: efConsignaText(meta.game, meta.instruction) };
  if (l10n.gl) text.gl = l10n.gl;
  if (l10n['es-DO']) text['es-DO'] = l10n['es-DO'];
  return { key: `ef.${domain}`, source: 'executiveFunctions', style: 'tutor', text };
});
