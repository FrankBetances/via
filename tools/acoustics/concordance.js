#!/usr/bin/env node
/**
 * Concordancia del análisis prosódico con la anotación MANUAL de un logopeda
 * (herramienta de build-time · hito B6).
 *
 *   node tools/acoustics/concordance.js --annotations muestras.json \
 *        [--annotations-b segundo-anotador.json] \
 *        [--audio-dir DIR] [--json informe.json] [--fail-under-icc 0.75]
 *
 * POR QUÉ ESTA HERRAMIENTA EXISTE
 *
 * `fixtures.js` + `validate.py` demuestran que el DSP calcula BIEN sobre señal
 * sintética: coincide con Praat al decimal en F0 y borda el recuento silábico
 * cuando las sílabas están perfectamente separadas. Eso NO dice que cuente bien
 * las sílabas de un niño de cinco años, con coarticulación, disfluencias,
 * alargamientos y ruido de sala.
 *
 * Y ya hay un indicio de que no: al verificar las consignas neuronales, el
 * mismo texto locutado por dos voces distintas dio 16 y 23 sílabas. El
 * estimador depende del locutor. Sobre habla infantil real puede depender
 * mucho más.
 *
 * Esta herramienta mide esa distancia. No la supone.
 *
 * ENTRADA — fichero de anotaciones (JSON), producido por el logopeda:
 *
 *   {
 *     "protocol": "docs/design/validacion-clinica-prosodia.md",
 *     "annotator": "iniciales o código del anotador",
 *     "samples": [
 *       {
 *         "file": "s001.wav",          // relativo a --audio-dir
 *         "ageMonths": 62,             // opcional, para estratificar
 *         "task": "narracion-lamina",
 *         "manual": {
 *           "syllables": 84,           // recuento manual (obligatorio)
 *           "pauses": 6,               // opcional
 *           "speechSec": 31.4          // opcional
 *         }
 *       }
 *     ]
 *   }
 *
 * ZERO-PHI: la herramienta lee audio de una carpeta LOCAL que nunca entra al
 * repositorio (ver .gitignore de este directorio) y escribe solo cifras
 * agregadas y por muestra anónima. Ni transcribe ni conserva el audio.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

/* --------------------------- carga del DSP real --------------------------- */

/** Compila y carga `prosodyDsp.ts`, el mismo módulo que corre en la app. */
function loadProsodyDsp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prosodydsp-cjs-'));
  const localTsc = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  const tsc = fs.existsSync(localTsc) ? localTsc : 'tsc';

  const tsconfig = path.join(tmp, 'tsconfig.json');
  fs.writeFileSync(tsconfig, JSON.stringify({
    extends: path.join(ROOT, 'tsconfig.json'),
    compilerOptions: {
      outDir: path.join(tmp, 'cjs'),
      rootDir: SRC,
      baseUrl: ROOT,
      module: 'commonjs',
      target: 'es2019',
      moduleResolution: 'node',
      noEmit: false,
      noEmitOnError: false,
      types: [],
      allowImportingTsExtensions: false,
      customConditions: null,
    },
    include: [],
    files: [path.join(SRC, 'Screens', 'ProsodyAnalysis', 'prosodyDsp.ts')],
  }));

  try {
    execFileSync(tsc, ['--project', tsconfig], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    /* errores de tipos tolerados: lo que importa es que haya emitido */
  }
  const out = path.join(tmp, 'cjs', 'Screens', 'ProsodyAnalysis', 'prosodyDsp.js');
  if (!fs.existsSync(out)) {
    throw new Error(`tsc no emitió el DSP en ${out} (revise el módulo con \`npm run tsc\`)`);
  }
  return require(out);
}

/* ------------------------------ audio → PCM ------------------------------- */

const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';

/**
 * Decodifica cualquier formato que entienda ffmpeg a PCM mono float32 a la
 * frecuencia del DSP. Se decodifica a 16 kHz directamente: el remuestreo de
 * ffmpeg es de mejor calidad que decimar aquí, y el DSP acondiciona igual.
 */
function decodeToPcm(file, sampleRate) {
  const raw = execFileSync(
    FFMPEG,
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', '-'],
    { maxBuffer: 1024 * 1024 * 512 },
  );
  return new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
}

/* ------------------------------- estadística ------------------------------ */

const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

function sd(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((acc, v) => acc + (v - m) ** 2, 0) / (a.length - 1));
}

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : NaN;
}

/**
 * Coeficiente de correlación intraclase, forma de CONCORDANCIA absoluta
 * (ICC(A,1), dos vías con efectos aleatorios).
 *
 * Se usa ICC y no Pearson porque Pearson mide si las dos medidas van JUNTAS,
 * no si COINCIDEN: un estimador que contara sistemáticamente la mitad de las
 * sílabas daría r = 1.0 y sería inservible. Y ese es exactamente el modo de
 * fallo que se sospecha aquí.
 */
function iccAbsoluteAgreement(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const k = 2;
  const rowMeans = [];
  for (let i = 0; i < n; i++) rowMeans.push((xs[i] + ys[i]) / 2);
  const grand = mean([...xs.slice(0, n), ...ys.slice(0, n)]);
  const colMeans = [mean(xs.slice(0, n)), mean(ys.slice(0, n))];

  let ssRows = 0;
  for (const rm of rowMeans) ssRows += (rm - grand) ** 2;
  ssRows *= k;

  let ssCols = 0;
  for (const cm of colMeans) ssCols += (cm - grand) ** 2;
  ssCols *= n;

  let ssTotal = 0;
  for (let i = 0; i < n; i++) {
    ssTotal += (xs[i] - grand) ** 2 + (ys[i] - grand) ** 2;
  }
  const ssErr = ssTotal - ssRows - ssCols;

  const msRows = ssRows / (n - 1);
  const msCols = ssCols / (k - 1);
  const msErr = ssErr / ((n - 1) * (k - 1));

  const denom = msRows + (k - 1) * msErr + (k * (msCols - msErr)) / n;
  return denom > 0 ? (msRows - msErr) / denom : NaN;
}

/** Sesgo y límites de concordancia de Bland-Altman (media ± 1.96·DE). */
function blandAltman(auto, manual) {
  const diffs = auto.map((v, i) => v - manual[i]);
  const bias = mean(diffs);
  const s = sd(diffs);
  return { bias, sd: s, lower: bias - 1.96 * s, upper: bias + 1.96 * s };
}

/* ---------------------------------- main ---------------------------------- */

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const annotationsPath = arg('--annotations');
  if (!annotationsPath) {
    console.error(
      'Uso: node tools/acoustics/concordance.js --annotations muestras.json ' +
        '[--audio-dir DIR] [--json informe.json] [--fail-under-icc 0.75]',
    );
    process.exit(2);
  }

  const annotations = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
  const audioDir = arg('--audio-dir', path.dirname(path.resolve(annotationsPath)));
  const samples = annotations.samples || [];
  if (!samples.length) {
    console.error('El fichero de anotaciones no contiene muestras.');
    process.exit(2);
  }

  const dsp = loadProsodyDsp();
  const sampleRate = dsp.SAMPLE_RATE;

  const rows = [];
  for (const s of samples) {
    const file = path.isAbsolute(s.file) ? s.file : path.join(audioDir, s.file);
    if (!fs.existsSync(file)) {
      console.error(`  ✗ falta el audio: ${file}`);
      continue;
    }
    const pcm = decodeToPcm(file, sampleRate);
    const r = await dsp.analyseProsody(pcm);
    const m = r.metrics;
    rows.push({
      id: s.id || path.basename(s.file, path.extname(s.file)),
      ageMonths: s.ageMonths ?? null,
      task: s.task ?? null,
      reason: r.stats.reason,
      durationSec: Number(m.durationSec.toFixed(2)),
      autoSyllables: m.syllableCount,
      manualSyllables: s.manual ? s.manual.syllables ?? null : null,
      autoPauses: m.pauseCount,
      manualPauses: s.manual ? s.manual.pauses ?? null : null,
      autoSpeechSec: m.spanSec === null ? null : Number(m.spanSec.toFixed(2)),
      manualSpeechSec: s.manual ? s.manual.speechSec ?? null : null,
      f0RangeSt: m.f0RangeSt === null ? null : Number(m.f0RangeSt.toFixed(2)),
    });
    process.stdout.write('.');
  }
  process.stdout.write('\n\n');

  /* -------------------------- informe por muestra -------------------------- */
  const head = `${'muestra'.padEnd(14)} ${'edad'.padStart(5)} ${'dur'.padStart(7)} ` +
    `${'síl auto'.padStart(9)} ${'síl man'.padStart(8)} ${'Δ'.padStart(6)} ${'%'.padStart(7)}`;
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const r of rows) {
    const d = r.autoSyllables !== null && r.manualSyllables !== null
      ? r.autoSyllables - r.manualSyllables
      : null;
    const pct = d !== null && r.manualSyllables ? (100 * d) / r.manualSyllables : null;
    console.log(
      `${r.id.padEnd(14)} ${(r.ageMonths ?? '—').toString().padStart(5)} ` +
        `${`${r.durationSec}s`.padStart(7)} ${String(r.autoSyllables ?? '—').padStart(9)} ` +
        `${String(r.manualSyllables ?? '—').padStart(8)} ${(d ?? '—').toString().padStart(6)} ` +
        `${pct === null ? '—'.padStart(7) : `${pct.toFixed(1)}%`.padStart(7)}`,
    );
  }

  /* ----------------------------- concordancia ------------------------------ */
  const paired = rows.filter(r => r.autoSyllables !== null && r.manualSyllables !== null);
  const auto = paired.map(r => r.autoSyllables);
  const manual = paired.map(r => r.manualSyllables);

  const summary = {
    samples: rows.length,
    paired: paired.length,
    notAnalysable: rows.filter(r => r.reason !== 'ok').length,
  };

  if (paired.length >= 3) {
    const ba = blandAltman(auto, manual);
    summary.syllables = {
      icc: Number(iccAbsoluteAgreement(auto, manual).toFixed(3)),
      pearson: Number(pearson(auto, manual).toFixed(3)),
      bias: Number(ba.bias.toFixed(2)),
      sdDiff: Number(ba.sd.toFixed(2)),
      limitsOfAgreement: [Number(ba.lower.toFixed(2)), Number(ba.upper.toFixed(2))],
      meanRelativeErrorPct: Number(
        (100 * mean(auto.map((v, i) => (v - manual[i]) / manual[i]))).toFixed(1),
      ),
    };

    console.log('\nCONCORDANCIA DEL RECUENTO SILÁBICO (automático vs. manual)');
    console.log(`  muestras emparejadas   ${paired.length}`);
    console.log(`  ICC(A,1)               ${summary.syllables.icc}`);
    console.log(`  Pearson r              ${summary.syllables.pearson}`);
    console.log(`  sesgo medio            ${summary.syllables.bias} sílabas`);
    console.log(
      `  límites de concordancia [${summary.syllables.limitsOfAgreement[0]}, ` +
        `${summary.syllables.limitsOfAgreement[1]}]`,
    );
    console.log(`  error relativo medio   ${summary.syllables.meanRelativeErrorPct} %`);
    console.log(
      '\n  ICC y no Pearson: un estimador que contara sistemáticamente la mitad\n' +
        '  de las sílabas daría r = 1.0 y sería inservible. El ICC de concordancia\n' +
        '  absoluta sí penaliza el sesgo, que es el modo de fallo que se sospecha.',
    );
  } else {
    console.log(
      `\nMuestras emparejadas insuficientes (${paired.length}): con menos de 3 no se\n` +
        'calcula concordancia. No se publica una cifra que no significa nada.',
    );
  }

  const pairedPauses = rows.filter(r => r.autoPauses !== null && r.manualPauses !== null);
  if (pairedPauses.length >= 3) {
    const a = pairedPauses.map(r => r.autoPauses);
    const m = pairedPauses.map(r => r.manualPauses);
    const ba = blandAltman(a, m);
    summary.pauses = {
      icc: Number(iccAbsoluteAgreement(a, m).toFixed(3)),
      bias: Number(ba.bias.toFixed(2)),
      limitsOfAgreement: [Number(ba.lower.toFixed(2)), Number(ba.upper.toFixed(2))],
    };
    console.log('\nCONCORDANCIA DEL RECUENTO DE PAUSAS');
    console.log(`  ICC(A,1)  ${summary.pauses.icc} · sesgo ${summary.pauses.bias}`);
  }

  /* ---------------- fiabilidad ENTRE ANOTADORES (protocolo §3.3) ------------ */
  /*  Contrastar el estimador contra un patrón de referencia poco fiable no mide */
  /*  el estimador: mide el ruido del patrón. Por eso el protocolo exige que un  */
  /*  ≥20 % de las muestras las anote una segunda persona, con ICC ≥ 0.90 entre  */
  /*  ellas. Si los anotadores no concuerdan, la Parte B no puede concluirse y   */
  /*  el ICC contra el automático NO significa nada.                             */
  const secondPath = arg('--annotations-b');
  if (secondPath) {
    const second = JSON.parse(fs.readFileSync(secondPath, 'utf8'));
    const byId = new Map();
    for (const s2 of second.samples || []) {
      const id = s2.id || path.basename(s2.file || '', path.extname(s2.file || ''));
      if (s2.manual && typeof s2.manual.syllables === 'number') byId.set(id, s2.manual.syllables);
    }
    const a = [];
    const b = [];
    for (const s1 of samples) {
      const id = s1.id || path.basename(s1.file, path.extname(s1.file));
      const other = byId.get(id);
      if (typeof other === 'number' && s1.manual && typeof s1.manual.syllables === 'number') {
        a.push(s1.manual.syllables);
        b.push(other);
      }
    }
    const coverage = samples.length ? a.length / samples.length : 0;
    summary.interAnnotator = {
      paired: a.length,
      coveragePct: Number((100 * coverage).toFixed(1)),
      icc: a.length >= 3 ? Number(iccAbsoluteAgreement(a, b).toFixed(3)) : null,
      meetsProtocol: null,
    };
    const icc = summary.interAnnotator.icc;
    summary.interAnnotator.meetsProtocol = icc !== null && icc >= 0.9 && coverage >= 0.2;

    console.log('\nFIABILIDAD ENTRE ANOTADORES');
    console.log(`  muestras dobles        ${a.length} (${summary.interAnnotator.coveragePct} %)`);
    console.log(`  ICC(A,1)               ${icc === null ? '— (insuficientes)' : icc}`);
    if (!summary.interAnnotator.meetsProtocol) {
      console.log(
        '  ⚠ No cumple el protocolo (ICC ≥ 0.90 sobre ≥ 20 % de las muestras).\n' +
          '    Sin patrón de referencia fiable, el ICC contra el automático no es\n' +
          '    interpretable: revise el criterio de anotación antes de concluir.',
      );
    }
  } else {
    console.log(
      '\nSin segundo anotador (--annotations-b): no se puede acreditar la\n' +
        'fiabilidad del patrón de referencia, que el protocolo exige antes de\n' +
        'dar por concluida la Parte B.',
    );
  }

  const outJson = arg('--json');
  if (outJson) {
    fs.writeFileSync(
      outJson,
      `${JSON.stringify({ annotator: annotations.annotator ?? null, summary, rows }, null, 2)}\n`,
    );
    console.log(`\nInforme → ${outJson}`);
  }

  const failUnder = arg('--fail-under-icc');
  if (failUnder && summary.syllables) {
    const threshold = Number(failUnder);
    if (!(summary.syllables.icc >= threshold)) {
      console.error(
        `\n✗ ICC ${summary.syllables.icc} por debajo del umbral declarado ${threshold}.`,
      );
      process.exit(1);
    }
    console.log(`\n✓ ICC ${summary.syllables.icc} ≥ umbral ${threshold}.`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
