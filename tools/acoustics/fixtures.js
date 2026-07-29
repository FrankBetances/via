#!/usr/bin/env node
/* eslint-disable no-console */
/* global Buffer */
/**
 * Generador de casos de prueba del análisis acústico (herramienta build-time).
 *
 *   node tools/acoustics/fixtures.js [--out-dir tools/acoustics/out]
 *
 * Sintetiza vocales /a/ sostenidas DETERMINISTAS, las escribe como WAV de 16
 * bits y las mide con el MISMO DSP que corre en la app
 * (`src/Screens/VoiceAnalysis/voiceDsp.ts`), volcando el resultado a
 * `via-measurements.json`.
 *
 * El WAV y el JSON los consume después `validate.py`, que mide los mismos
 * ficheros con Praat (parselmouth) y compara. Ver `tools/acoustics/README.md`.
 *
 * Se compila el módulo de DSP con el `tsc` del proyecto (mismo patrón que
 * `scripts/export-voice-corpus.js`): si `voiceDsp.ts` dejara de ser puro
 * —importando React Native o UI— la compilación falla AQUÍ, no en la app.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

/* --------------------------- carga del DSP real --------------------------- */

function loadVoiceDsp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voicedsp-cjs-'));
  const localTsc = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  const tsc = fs.existsSync(localTsc) ? localTsc : 'tsc';

  // Se compila con un tsconfig propio (y no con banderas sueltas) porque el
  // módulo usa el alias `@/…` de la app: sin `paths`, tsc no resuelve ni los
  // imports de solo tipo y aborta.
  const tsconfig = path.join(tmp, 'tsconfig.json');
  fs.writeFileSync(tsconfig, JSON.stringify({
    // Se hereda el tsconfig de la app para no duplicar sus opciones (alias
    // `@/…`, decoradores de TypeORM que llegan por la cadena de imports de
    // tipos, etc.): así el DSP se compila EXACTAMENTE igual que en la app.
    extends: path.join(ROOT, 'tsconfig.json'),
    compilerOptions: {
      outDir: path.join(tmp, 'cjs'),
      rootDir: SRC,
      baseUrl: ROOT,
      module: 'commonjs',
      target: 'es2019',
      moduleResolution: 'node',
      jsx: 'react',
      noEmit: false,
      noEmitOnError: false,
      // El preset de React Native trae opciones pensadas para el bundler y
      // para el proyecto entero; aquí solo se compila un módulo puro a CJS.
      types: [],
      allowImportingTsExtensions: false,
      // `customConditions` del preset solo vale con moduleResolution
      // bundler/node16; aquí se resuelve como node clásico.
      customConditions: null,
    },
    include: [],
    files: [path.join(SRC, 'Screens', 'VoiceAnalysis', 'voiceDsp.ts')],
  }));

  // `noEmitOnError: false` hace que tsc EMITA aunque queden errores de tipos.
  // Aquí interesa solo el JavaScript: sin las librerías de tipos del entorno
  // (`types: []`, para no arrastrar el preset completo de React Native) tsc se
  // queja de `setTimeout` y compañía, que en este módulo no se usan. El
  // typecheck de verdad del proyecto es `npm run tsc`, que sí corre completo.
  try {
    execFileSync(tsc, ['--project', tsconfig], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    /* errores de tipos tolerados: lo que importa es que haya emitido */
  }
  const out = path.join(tmp, 'cjs', 'Screens', 'VoiceAnalysis', 'voiceDsp.js');
  if (!fs.existsSync(out)) {
    throw new Error(`tsc no emitió el DSP en ${out} (revise el módulo con \`npm run tsc\`)`);
  }
  return require(out);
}

/* ------------------------------ señales de prueba ------------------------- */

/**
 * /a/ sostenida sintética: tren de armónicos de `f0` conformado por una
 * envolvente con tres resonancias, más las perturbaciones e interferencias
 * pedidas. Determinista (sin `Math.random`): el mismo caso produce siempre el
 * mismo WAV, así que un cambio en el JSON de medidas es un cambio REAL del DSP
 * y no ruido de muestreo.
 */
function vowel(sampleRate, {
  f0 = 200,
  seconds = 3,
  formants = [700, 1200, 2600],
  jitterPct = 0,
  shimmerPct = 0,
  noise = 0,
  dc = 0,
  driftHz = 0,
  driftAmp = 0,
} = {}) {
  const n = Math.floor(sampleRate * seconds);
  const x = new Float32Array(n);

  // Ruido reproducible (congruencial lineal), no `Math.random`.
  let seed = 20260729;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };

  // Fase acumulada: permite modular el periodo muestra a muestra (jitter).
  let phase = 0;
  let period = 0;
  let amp = 1;

  for (let i = 0; i < n; i++) {
    if (phase <= 0) {
      // Nuevo ciclo glotal: periodo y amplitud se perturban ALEATORIAMENTE
      // (con el generador reproducible de arriba), no alternando el signo.
      // Alternar produce una señal con DOBLADO DE PERIODO —dos ciclos
      // consecutivos distintos que se repiten— cuya F0 real es la mitad;
      // Praat lo detectaba correctamente como 100 Hz y parecía que VIA+ se
      // equivocaba, cuando el caso de prueba era el que estaba mal construido.
      period = (sampleRate / f0) * (1 + (2 * rand() * jitterPct) / 100);
      amp = 1 + (2 * rand() * shimmerPct) / 100;
      phase = period;
    }
    phase -= 1;

    const t = (period - phase) / period; // 0..1 dentro del ciclo
    let s = 0;
    for (let h = 1; h <= 40; h++) {
      const f = f0 * h;
      if (f > sampleRate / 2) break;
      let env = 0.02;
      for (let k = 0; k < formants.length; k++) {
        const weight = [1, 0.6, 0.3][k] ?? 0.2;
        const bw = [120, 160, 220][k] ?? 250;
        env += weight / (1 + Math.pow((f - formants[k]) / bw, 2));
      }
      s += env * Math.sin(2 * Math.PI * h * t + h);
    }

    x[i] =
      amp * 0.08 * s +
      noise * rand() +
      dc +
      driftAmp * Math.sin((2 * Math.PI * driftHz * i) / sampleRate);
  }
  return x;
}

/** Casos: voz sana, voces con perturbación conocida y capturas contaminadas. */
const CASES = [
  { name: 'infantil-sana-200hz', opts: { f0: 200 } },
  { name: 'adulta-grave-110hz', opts: { f0: 110 } },
  { name: 'adulta-aguda-260hz', opts: { f0: 260 } },
  { name: 'jitter-1pct-200hz', opts: { f0: 200, jitterPct: 1 } },
  { name: 'shimmer-8pct-200hz', opts: { f0: 200, shimmerPct: 8 } },
  // Escalera de ruido: da HNR en el rango CLÍNICO (≈5–25 dB), que es donde la
  // medida significa algo. Sobre señal sin ruido, el HNR de VIA+ satura en su
  // techo declarado y Praat da valores de 70–85 dB: comparar ahí no informa.
  { name: 'ruido-leve-200hz', opts: { f0: 200, noise: 0.003 } },
  { name: 'ruido-aditivo-200hz', opts: { f0: 200, noise: 0.01 } },
  { name: 'ruido-medio-200hz', opts: { f0: 200, noise: 0.03 } },
  { name: 'ruido-fuerte-200hz', opts: { f0: 200, noise: 0.06 } },
  { name: 'continua-200hz', opts: { f0: 200, dc: 0.2 } },
  { name: 'deriva-3hz-200hz', opts: { f0: 200, driftHz: 3, driftAmp: 0.3 } },
  { name: 'retumbe-20hz-200hz', opts: { f0: 200, driftHz: 20, driftAmp: 0.3 } },
  { name: 'vocal-i-200hz', opts: { f0: 200, formants: [300, 2300, 3000] } },
  { name: 'vocal-u-200hz', opts: { f0: 200, formants: [350, 800, 2400] } },
];

/* ------------------------------- WAV de 16 bits --------------------------- */

function writeWav(file, pcm, sampleRate) {
  const data = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // tamaño del bloque fmt
  header.writeUInt16LE(1, 20); // PCM entero
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // bytes por segundo
  header.writeUInt16LE(2, 32); // alineación de bloque
  header.writeUInt16LE(16, 34); // bits por muestra
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

/* ---------------------------------- main ---------------------------------- */

async function main() {
  const outIdx = process.argv.indexOf('--out-dir');
  const outDir = outIdx >= 0
    ? path.resolve(process.argv[outIdx + 1])
    : path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const dsp = loadVoiceDsp();
  const sampleRate = dsp.SAMPLE_RATE;

  const measurements = { sampleRate, cases: {} };

  for (const { name, opts } of CASES) {
    const pcm = vowel(sampleRate, opts);
    // Se escriben DOS ficheros:
    //  · `<caso>.wav` — la señal cruda, tal y como la entregaría el micrófono;
    //  · `<caso>.conditioned.wav` — tras el acondicionado de VIA+, que es la
    //    señal que el DSP analiza de verdad.
    // La comparación con Praat se hace sobre la ACONDICIONADA: medir la cruda
    // le pedía a Praat que analizase un infrasonido que VIA+ ya ha quitado, y
    // la discrepancia resultante no dice nada del estimador.
    writeWav(path.join(outDir, `${name}.wav`), pcm, sampleRate);
    writeWav(path.join(outDir, `${name}.conditioned.wav`), dsp.conditionForAnalysis(pcm), sampleRate);

    const r = await dsp.analysePcm(pcm);
    const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    measurements.cases[name] = {
      expected: { f0: opts.f0 ?? 200, jitterPct: opts.jitterPct ?? 0, shimmerPct: opts.shimmerPct ?? 0 },
      via: {
        f0: mean(r.f0s),
        voicedFrames: r.f0s.length,
        totalFrames: r.stats ? r.stats.totalFrames : null,
        hnr: mean(r.hnrs || []),
        formants: r.formants,
      },
    };
    process.stdout.write('.');
  }

  fs.writeFileSync(
    path.join(outDir, 'via-measurements.json'),
    `${JSON.stringify(measurements, null, 2)}\n`,
  );
  console.log(`\n${CASES.length} casos → ${path.relative(ROOT, outDir)}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
