import { buildArticulationItems } from '../Screens/Articulation/articulationResult';
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

/** Banco de consignas de la batería (hoy: los 5 mini-juegos de FE).
 *
 * `es-DO` se enumera SIEMPRE, con el texto castellano si el revisor dominicano
 * aún no ha firmado un delta. No es un atajo de traducción: es la misma lengua
 * y lo que cambia es la VOZ, igual que en `TAR_MODELS`. Sin esta entrada, una
 * sesión dominicana resolvía al recorte base `es` y los mini-juegos se
 * explicaban con acento peninsular mientras el resto de la batería ya sonaba
 * en dominicano — reportado en campo como «funciones ejecutivas no tiene las
 * voces neuronales». Cuando el delta se firme, `EF_CONSIGNA_L10N` lo sustituye
 * y el id cambia solo para esa consigna.
 *
 * El gallego y el euskera NO se enumeran por defecto: ahí el texto sí es otro
 * idioma y meterlo sin revisión humana sería traducción automática encubierta
 * (P6). Sin delta firmado, esas sesiones degradan al recorte castellano. */
export const CONSIGNAS: ConsignaSpec[] = EF_DOMAIN_ORDER.map(domain => {
  const meta = EF_DOMAIN_META[domain];
  const l10n = EF_CONSIGNA_L10N[domain] ?? {};
  const es = efConsignaText(meta.game, meta.instruction);
  const text: ConsignaText = { es, 'es-DO': l10n['es-DO'] ?? es };
  if (l10n.gl) text.gl = l10n.gl;
  return { key: `ef.${domain}`, source: 'executiveFunctions', style: 'tutor', text };
});

/**
 * Modelos hablados del T.A.R. (Test de Articulación a la Repetición).
 *
 * El módulo presenta una palabra o frase para que el niño/a la repita, y esa
 * presentación es el estímulo: hasta ahora salía por el TTS del sistema con la
 * voz que hubiera instalada, mientras el resto de la app ya locutaba con voz
 * neuronal. Enumerar el inventario aquí lo mete en el mismo pipeline que las
 * consignas, así que cada palabra pasa a tener recorte propio en cuanto se
 * sintetiza el corpus.
 *
 * DERIVA CERO (P3): el texto se deriva de `buildArticulationItems()` — la
 * MISMA función que dicta la pantalla —, así que corpus e inventario no pueden
 * divergir. Si una palabra cambia, cambia su id y esa locución cae limpiamente
 * a la voz del sistema hasta que se regenere.
 *
 * LENGUAS: el inventario T.A.R. es castellano (fonología del español) y se
 * enumera para `es` y para la variante dominicana `es-DO`, que comparte
 * inventario y solo cambia de VOZ. El gallego y el euskera no aparecen: no
 * tienen inventario articulatorio propio todavía, y `resolveVoiceAsset` ya
 * degrada esas sesiones al recorte base `es` (la palabra sigue siendo la
 * castellana que se está evaluando).
 */
export const TAR_MODELS: ConsignaSpec[] = [
  ...new Set(buildArticulationItems().map(item => item.word)),
].map(word => ({
  key: `tar.${word}`,
  source: 'articulation',
  style: 'tutor' as VoiceStyle,
  text: { es: word, 'es-DO': word },
}));

/**
 * Todos los bancos de contenido locutable de la app. `buildVoiceCorpus` los
 * recorre en orden; añadir un banco nuevo aquí lo incorpora al corpus, al
 * pipeline de síntesis y a los tests de invariantes sin tocar nada más.
 */
export const VOICE_CONTENT_BANKS: ConsignaSpec[] = [...CONSIGNAS, ...TAR_MODELS];
