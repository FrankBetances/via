/* eslint-disable no-console */
/**
 * Ritmo de las locuciones sintetizadas — criterio ÚNICO para los dos bancos.
 *
 * Lo comparten `verbal-assets.js` (recortes de la audiometría verbal) y
 * `synthesize-voice-corpus.js` (corpus general: consignas de funciones
 * ejecutivas y modelos hablados del T.A.R.), porque el defecto es el mismo en
 * los dos y hasta ahora solo uno lo vigilaba:
 *
 *   · la audiometría verbal SÍ comprobaba la duración, pero se limitaba a
 *     lanzar: el banco entero se descartaba, el workflow lo anotaba como
 *     «idioma fallido» con un aviso y en el árbol se quedaban los recortes
 *     viejos —los atropellados—. El arreglo no llegaba nunca a los .m4a y el
 *     defecto sobrevivía a su propio parche sin que nadie viera un fallo;
 *   · el corpus general NO comprobaba nada, y por ahí se colaron modelos
 *     hablados del T.A.R. como «Tapa» en 140 ms o «Apto» en 163 ms, que no se
 *     oyen como una palabra sino como un chasquido.
 *
 * El criterio: ninguna locución por debajo de `MIN_CLIP_MS`. La referencia es
 * el banco es-DO (Quisqueya Habla), que es el que suena bien en campo — su
 * recorte más corto son 376 ms.
 *
 * La corrección NO es subir el `lengthScale` global de la voz. La velocidad de
 * `es_ES-davefx-medium` no se desvía de forma uniforme: mantiene las
 * polisílabas en un ritmo razonable y desploma las cortas («pan» 151 ms frente
 * a los 386 ms del es-DO, 2,6 veces más rápido), así que el lengthScale que
 * rescataría a «pan» dejaría el resto del banco arrastrándose. Se realentiza
 * RECORTE A RECORTE: solo se vuelven a sintetizar los cortos, con el
 * lengthScale justo para alcanzar el suelo.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * Duración mínima admisible de una locución, en milisegundos.
 *
 * Un estímulo del T.A.R. o de la audiometría verbal es una palabra AISLADA que
 * el paciente tiene que reconocer o repetir: por debajo de este umbral no está
 * «rápido», está atropellado o truncado, y la respuesta deja de medir lo que
 * dice medir.
 *
 * Se ajusta con `VERBAL_MIN_CLIP_MS` (0 lo desactiva) para no dejar bloqueada
 * una regeneración legítima; bajarlo debería ser una decisión consciente y
 * anotada, no la vía de salida por defecto.
 */
const MIN_CLIP_MS = Number(process.env.VERBAL_MIN_CLIP_MS ?? 350);

/**
 * Techo del `lengthScale` por recorte al realentizar. Es una salvaguarda: si
 * una locución necesita más que esto para llegar al suelo, el problema no es
 * el ritmo sino la síntesis (texto mal fonemizado, modelo inadecuado), y hay
 * que verlo, no taparlo estirando el audio hasta lo grotesco.
 */
const MAX_LENGTH_SCALE = Number(process.env.VERBAL_MAX_LENGTH_SCALE ?? 3.6);

/** Intentos de realentizado por recorte antes de rendirse. */
const SLOWDOWN_ATTEMPTS = 3;

/**
 * Duración (segundos) de un .m4a leyendo el átomo `mvhd` del contenedor MP4.
 * Se hace a mano para no exigir ffprobe: en los runners está ffmpeg, pero el
 * binario de respaldo (el de Playwright) viene recortado y ni siquiera
 * demultiplexa MP4. Devuelve `null` si el contenedor no es legible.
 */
function m4aDurationSeconds(file) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return null;
  }
  const findAtom = (start, end, type) => {
    let pos = start;
    while (pos + 8 <= end) {
      let size = buf.readUInt32BE(pos);
      const name = buf.toString('latin1', pos + 4, pos + 8);
      let header = 8;
      if (size === 1) {
        size = Number(buf.readBigUInt64BE(pos + 8));
        header = 16;
      }
      if (size < header) return null;
      if (name === type) return { body: pos + header, end: pos + size };
      pos += size;
    }
    return null;
  };
  const moov = findAtom(0, buf.length, 'moov');
  if (!moov) return null;
  const mvhd = findAtom(moov.body, moov.end, 'mvhd');
  if (!mvhd) return null;
  const version = buf[mvhd.body];
  const p = mvhd.body + 4 + (version === 1 ? 16 : 8);
  const timescale = buf.readUInt32BE(p);
  const duration = version === 1 ? Number(buf.readBigUInt64BE(p + 4)) : buf.readUInt32BE(p + 4);
  if (!timescale) return null;
  return duration / timescale;
}

/** Contenido de un archivo, o `null` si aún no existe o no se puede leer. */
function readOrNull(file) {
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

/** `lengthScale` declarado para la voz de `lang` en voices.json (1 si no lo declara). */
function baseLengthScale(lang) {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'nos', 'voices.json'), 'utf8'));
    return Number(reg.voices?.[lang]?.params?.lengthScale) || 1;
  } catch {
    return 1;
  }
}

/** Mide las locuciones ya codificadas: [{ item, seconds }] de las legibles. */
function measure(items, fileFor) {
  const out = [];
  for (const item of items) {
    const seconds = m4aDurationSeconds(fileFor(item));
    if (seconds != null) out.push({ item, seconds });
  }
  return out;
}

/**
 * Lleva el banco recién codificado por encima del suelo de duración, y falla si
 * no lo consigue.
 *
 * @param {object}   o
 * @param {Array}    o.items     locuciones (objetos opacos para este módulo)
 * @param {Function} o.fileFor   item → ruta del .m4a ya codificado
 * @param {Function} o.labelFor  item → texto legible para los mensajes
 * @param {string}   o.lang      lengua/variante (para leer su lengthScale base)
 * @param {Function} o.resynth   (item, lengthScale) → re-sintetiza y RECODIFICA
 *                               esa locución. `null` desactiva el realentizado
 *                               (motores sin control de ritmo, p. ej. espeak):
 *                               entonces esto es solo una comprobación.
 */
function enforceClipTempo({ items, fileFor, labelFor, lang, resynth }) {
  const report = measured => {
    if (!measured.length) return;
    const mean = measured.reduce((a, m) => a + m.seconds, 0) / measured.length;
    const shortest = [...measured].sort((a, b) => a.seconds - b.seconds)[0];
    console.log(
      `${lang}: duración media ${mean.toFixed(3)} s · más corta «${labelFor(shortest.item)}» ${shortest.seconds.toFixed(3)} s`,
    );
  };

  let measured = measure(items, fileFor);
  if (!measured.length) return;
  report(measured);
  if (MIN_CLIP_MS <= 0) return;

  let short = measured.filter(m => m.seconds * 1000 < MIN_CLIP_MS);
  const base = baseLengthScale(lang);
  /* Último intento REALMENTE hecho por locución: { scale, seconds }. Es lo que
   * hace converger el bucle: la regla de tres tiene que partir de la escala que
   * produjo la duración que se acaba de medir, no de la escala base.
   * Calculándola siempre desde `base`, el segundo intento leía una duración
   * obtenida con una escala mayor y deducía una escala MENOR — el recorte
   * volvía a acelerarse y el bucle oscilaba hasta agotar los intentos. */
  const lastTry = new Map();
  /* Mejor intento CONSERVADO por locución: { seconds, scale, bytes }. El realentizado
   * sobrescribe el .m4a en cada pasada, así que sin esto un intento peor que el
   * anterior se queda tal cual. No es hipotético: «Tapa» llegó a 244 ms, el
   * intento siguiente salió en 163 ms y ese —el peor— es el que acabó
   * commiteado. Aquí el archivo guarda siempre el mejor intento; la regla de
   * tres sigue razonando sobre el último, que es su linealización válida. */
  const best = new Map();
  /** lengthScale que le haría falta a `seconds` viniendo de la escala `from`. */
  const demanded = (from, seconds) => from * (MIN_CLIP_MS / 1000 / seconds) * 1.12;

  let slowed = false;
  for (let attempt = 1; attempt <= SLOWDOWN_ATTEMPTS && short.length && resynth; attempt += 1) {
    let retried = 0;
    for (const m of short) {
      const last = lastTry.get(m.item);
      const from = last ? last.scale : base;
      const seen = last ? last.seconds : m.seconds;
      // Regla de tres sobre la duración medida, con un 12 % de margen: en un
      // VITS con la semilla fija la duración es proporcional al lengthScale, así
      // que una pasada basta; los intentos restantes cubren los casos en que el
      // post-proceso recorta algo más de lo previsto.
      const wanted = demanded(from, seen);
      const scale = Math.min(MAX_LENGTH_SCALE, wanted);
      // Ya estaba en el techo y sigue corta: insistir solo gasta síntesis y, si
      // el techo se alcanzó por redondeo, reintroduce la oscilación.
      if (scale <= from + 1e-6) continue;
      console.log(
        `  ${lang}: «${labelFor(m.item)}» ${(seen * 1000).toFixed(0)} ms → lengthScale ${scale.toFixed(2)}`
          + (scale < wanted ? ` (pedía ${wanted.toFixed(2)}, techo ${MAX_LENGTH_SCALE})` : ''),
      );
      const file = fileFor(m.item);
      if (!best.has(m.item)) best.set(m.item, { seconds: m.seconds, scale: base, bytes: readOrNull(file) });
      resynth(m.item, scale);
      const got = m4aDurationSeconds(file);
      lastTry.set(m.item, { scale, seconds: got ?? seen });
      const kept = best.get(m.item);
      if (got != null && got > kept.seconds) best.set(m.item, { seconds: got, scale, bytes: readOrNull(file) });
      else if (kept.bytes) fs.writeFileSync(file, kept.bytes);
      retried += 1;
    }
    if (!retried) break;
    slowed = true;
    measured = measure(items, fileFor);
    short = measured.filter(m => m.seconds * 1000 < MIN_CLIP_MS);
  }

  if (!short.length) {
    // Solo si se ha tocado algo: repetir la misma línea cuando no hubo
    // realentizado no informaba de nada y hacía leer dos veces el log.
    if (slowed) report(measured);
    return;
  }

  // El lengthScale que pedía se deduce del recorte QUE HA QUEDADO y de la
  // escala que lo produjo, no del último intento: si ese último salió peor se
  // descartó, y citarlo daría una cifra que no cuadra con la duración de al
  // lado —el que lea el error se pondría a buscar una incoherencia que no hay.
  const detail = short
    .map(m => {
      const from = best.get(m.item)?.scale ?? base;
      return `«${labelFor(m.item)}» (${(m.seconds * 1000).toFixed(0)} ms`
        + (resynth ? `, pedía lengthScale ${demanded(from, m.seconds).toFixed(2)}` : '')
        + ')';
    })
    .join(', ');
  throw new Error(
    `${lang}: ${short.length} locución(es) por debajo de ${MIN_CLIP_MS} ms${resynth ? ' tras realentizarlas' : ''} — ${detail}.\n`
      + 'Un estímulo así queda atropellado y deja de medir lo que dice medir.\n'
      + (resynth
        ? `Si el techo (VERBAL_MAX_LENGTH_SCALE=${MAX_LENGTH_SCALE}) no basta, el problema no es el ritmo: `
          + `revise la voz "${lang}" en tools/nos/voices.json — un modelo que necesita estirarse tanto no sirve para el estímulo.`
        : `Suba el lengthScale de la voz "${lang}" en tools/nos/voices.json, o use el motor neural, que sí admite realentizado por recorte.`),
  );
}

module.exports = {
  MIN_CLIP_MS,
  MAX_LENGTH_SCALE,
  SLOWDOWN_ATTEMPTS,
  m4aDurationSeconds,
  baseLengthScale,
  measure,
  enforceClipTempo,
};
