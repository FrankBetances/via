/**
 * Suelo de duración de las locuciones sintetizadas (`scripts/voice-clip-tempo.js`).
 *
 * Los .m4a se falsifican con un `moov`/`mvhd` mínimo —que es lo único que lee
 * `m4aDurationSeconds`—, así que la prueba corre sin ffmpeg y sin pesos de voz.
 * Lo que se comprueba es el LAZO de realentizado, que es donde estaba el
 * defecto: convergía o no según el sorteo de ruido del VITS, y podía dejar
 * publicado un recorte PEOR que el que ya tenía.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  enforceClipTempo,
  m4aDurationSeconds,
  MIN_CLIP_MS,
  MAX_LENGTH_SCALE,
} = require('../voice-clip-tempo');

const TIMESCALE = 44100;

/** .m4a de mentira: solo `moov`/`mvhd`, con la duración pedida. */
function writeFakeM4a(file, ms) {
  const mvhd = Buffer.alloc(28);
  mvhd.writeUInt32BE(28, 0);
  mvhd.write('mvhd', 4);
  mvhd.writeUInt32BE(0, 8); // version 0 + flags
  mvhd.writeUInt32BE(0, 12); // creation
  mvhd.writeUInt32BE(0, 16); // modification
  mvhd.writeUInt32BE(TIMESCALE, 20);
  mvhd.writeUInt32BE(Math.round((ms / 1000) * TIMESCALE), 24);
  const moov = Buffer.alloc(8);
  moov.writeUInt32BE(8 + mvhd.length, 0);
  moov.write('moov', 4);
  fs.writeFileSync(file, Buffer.concat([moov, mvhd]));
}

/**
 * Ejecuta el lazo sobre una locución.
 *
 * @param baseMs      duración de salida de la síntesis
 * @param durationFor (scale, nIntento) → duración que devuelve el re-sintetizado;
 *                    `null` = sin realentizado (motor tipo espeak)
 */
function runTempo(baseMs, durationFor) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tempo-'));
  const file = path.join(dir, 'clip.m4a');
  const item = { id: 'clip', text: 'pan' };
  writeFakeM4a(file, baseMs);

  const tried = [];
  let error = null;
  try {
    enforceClipTempo({
      items: [item],
      fileFor: () => file,
      labelFor: e => e.text,
      // Lengua sin voz registrada en voices.json: lengthScale base 1, para que
      // la prueba no dependa del ritmo declarado para el castellano.
      lang: 'xx',
      resynth: durationFor
        ? (e, scale) => {
          const ms = durationFor(scale, tried.length);
          tried.push({ scale, ms });
          writeFakeM4a(file, ms);
        }
        : null,
    });
  } catch (e) {
    error = e;
  }
  const publishedMs = Math.round(m4aDurationSeconds(file) * 1000);
  fs.rmSync(dir, { recursive: true, force: true });
  return { tried, publishedMs, error };
}

describe('enforceClipTempo', () => {
  it('deja pasar sin tocar nada el banco que ya está por encima del suelo', () => {
    const { tried, publishedMs, error } = runTempo(MIN_CLIP_MS + 50, () => 0);
    expect(error).toBeNull();
    expect(tried).toHaveLength(0);
    expect(publishedMs).toBe(MIN_CLIP_MS + 50);
  });

  it('rescata la locución corta en UNA pasada cuando la duración es proporcional al lengthScale', () => {
    // Es el comportamiento del VITS con la semilla fija (`onnxruntime.set_seed`):
    // el sorteo del predictor de duración no cambia entre inferencias, así que
    // la regla de tres del lazo acierta a la primera.
    const baseMs = 163;
    const { tried, publishedMs, error } = runTempo(baseMs, scale => Math.round(baseMs * scale));

    expect(error).toBeNull();
    expect(tried).toHaveLength(1);
    expect(tried[0].scale).toBeLessThanOrEqual(MAX_LENGTH_SCALE);
    expect(publishedMs).toBeGreaterThanOrEqual(MIN_CLIP_MS);
  });

  it('NO publica un intento peor que el mejor ya alcanzado', () => {
    // El caso que se vio en CI con «Tapa»: llegó a 244 ms, el intento siguiente
    // salió en 163 ms y era ese —el peor— el que quedaba en el árbol y se
    // commiteaba. El lazo debe conservar el mejor y seguir fallando, porque
    // 244 ms sigue estando por debajo del suelo.
    const { publishedMs, error } = runTempo(163, (scale, n) => (n === 0 ? 244 : 163));

    expect(error).not.toBeNull();
    expect(publishedMs).toBe(244);
  });

  it('falla citando el lengthScale que le haría falta al recorte QUE QUEDA publicado', () => {
    const { publishedMs, error } = runTempo(163, (scale, n) => (n === 0 ? 244 : 163));
    const from = error.message.match(/pedía lengthScale ([\d.]+)/);

    expect(from).not.toBeNull();
    expect(error.message).toContain(`${publishedMs} ms`);
    // Coherente con la duración publicada: nunca deducido del intento descartado.
    expect(Number(from[1])).toBeGreaterThan(MAX_LENGTH_SCALE * 0.5);
    expect(Number(from[1])).toBeLessThan(MAX_LENGTH_SCALE * 2);
  });

  it('sin realentizado (motor sin control de ritmo) comprueba pero no re-sintetiza', () => {
    const { tried, publishedMs, error } = runTempo(163, null);

    expect(tried).toHaveLength(0);
    expect(publishedMs).toBe(163);
    expect(error.message).toContain('Suba el lengthScale');
  });
});
