/**
 * INVARIANTES DE LA ARQUITECTURA DE VOZ — portada de Valeria+.
 *
 * Esta prueba existe por un motivo concreto: la cadena de voz de VIA+ se portó
 * de Valeria+ y la copia se desvió en silencio. El castellano acabó locutado con
 * una voz que Valeria nunca usó (`es_ES-davefx-medium`), que desploma los
 * monosílabos —«pan» 116 ms medido sobre el WAV, antes de post-procesar— y que
 * ningún realentizado levantaba hasta el suelo clínico de 350 ms. Costó una voz
 * inservible en producción y varias corridas de CI en rojo.
 *
 * Lo que se fija aquí NO es estilo: es la receta. Si alguien cambia la tabla de
 * ritmos, la voz castellana, la procedencia de una voz o borra el documento de
 * integración, esta prueba falla y obliga a hacerlo A CONCIENCIA.
 *
 * Referencia: FrankBetances/Valeria · scripts/generate-voice-assets.py
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'nos', 'voices.json'), 'utf8'));

describe('arquitectura de voz · reglas de Valeria+', () => {
  it('el ritmo por estilo es EXACTAMENTE el de Valeria (LENGTH_SCALE)', () => {
    // scripts/generate-voice-assets.py:
    //   LENGTH_SCALE = {"tutor": 1.0, "child": 1.05, "clinical": 1.15, "slow": 1.6}
    const t = registry.styleLengthScale;
    expect(t).toBeDefined();
    expect(t.tutor).toBe(1.0);
    expect(t.child).toBe(1.05);
    expect(t.clinical).toBe(1.15);
    expect(t.slow).toBe(1.6);
  });

  it('el castellano usa la voz de Valeria, no una elegida por VIA+', () => {
    expect(registry.voices.es.model).toBe('es_ES-sharvard-medium');
    expect(registry.voices.es.engine).toBe('piper');
  });

  it('davefx no vuelve por ninguna puerta', () => {
    const declared = Object.values(registry.voices).map(v => v.model);
    expect(declared).not.toContain('es_ES-davefx-medium');
    const fetchSh = fs.readFileSync(path.join(ROOT, 'tools', 'nos', 'fetch-models.sh'), 'utf8');
    expect(fetchSh).not.toContain('davefx');
  });

  it('toda voz declara de dónde sale', () => {
    for (const [lang, v] of Object.entries(registry.voices)) {
      expect(typeof v.origin).toBe('string');
      expect(v.origin.length).toBeGreaterThan(20);
      expect(`${lang}:${v.origin}`).toBeTruthy();
    }
  });

  it('fetch-models.sh descarga los modelos Piper que el registro declara', () => {
    // La deriva clásica: cambiar la voz en voices.json y dejar el script
    // bajando la anterior. El job muere al no encontrar el .onnx.
    const fetchSh = fs.readFileSync(path.join(ROOT, 'tools', 'nos', 'fetch-models.sh'), 'utf8');
    for (const v of Object.values(registry.voices)) {
      if (v.engine !== 'piper') continue;
      expect(fetchSh).toContain(`${v.model}.onnx`);
    }
  });

  it('el suelo de duración sigue en pie y es el del banco es-DO', () => {
    const tempo = require('../voice-clip-tempo');
    expect(tempo.MIN_CLIP_MS).toBe(350);
    expect(tempo.MAX_LENGTH_SCALE).toBe(3.6);
  });

  it('el documento de integración con Valeria existe y nombra las divergencias', () => {
    const doc = path.join(ROOT, 'docs', 'design', 'integracion-valeria.md');
    expect(fs.existsSync(doc)).toBe(true);
    const txt = fs.readFileSync(doc, 'utf8');
    // Las tres divergencias DELIBERADAS deben quedar justificadas por escrito:
    // sin esto, el siguiente que lea Valeria las "corrige" y rompe la
    // calibración de nivel de la audiometría.
    expect(txt).toContain('loudnorm');
    expect(txt).toContain('pico −3 dBFS');
    expect(txt).toContain('es_ES-sharvard-medium');
  });

  it('la receta que dispara la regeneración incluye el ritmo por estilo', () => {
    // Cambiar el lengthScale de un estilo cambia el audio igual que cambiar de
    // modelo: si no entrase en la receta, el banco se quedaría con el ritmo
    // viejo y nada lo delataría en el diff.
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'synthesize-voice-corpus.js'), 'utf8');
    const recipeBlock = src.slice(src.indexOf('function declaredRecipe'), src.indexOf('function readRecipes'));
    expect(recipeBlock).toContain('styleLengthScale');
  });

  it('la síntesis del corpus agrupa por estilo (el ritmo se hornea, no se estira)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'synthesize-voice-corpus.js'), 'utf8');
    expect(src).toContain('byStyle');
    expect(src).toContain('--length-scale');
    // Valeria es explícita: nunca `atempo` posterior sobre el audio ya
    // renderizado (estiraría los silencios y añadiría artefactos de resampleo).
    // Se comprueba el USO en un filtro de ffmpeg, no la palabra en un comentario.
    expect(src).not.toContain('atempo=');
  });
});
