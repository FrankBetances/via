import {
  collectLangAssetInventory,
  getVerbalBands,
  resolveVerbalLang,
  VERBAL_BANK_BASE,
  VERBAL_AUDIO_PENDING,
  VERBAL_BANK_BORROWED,
  VERBAL_BANK_LANGS,
  VERBAL_BANK_PROVISIONAL,
} from '../verbalAudiometryBanks';
import { buildEsDoBands, ES_DO_ITEM_OVERRIDES } from '../verbalAudiometryLists.es-DO';
import { collectAssetInventory, VERBAL_BANDS } from '../verbalAudiometryLists';

/* -------------------------------------------------------------------------- */
/*  Selector multi-idioma del banco verbal (infra M1/Q1 · Quisqueya Habla).    */
/*                                                                             */
/*  Verifica: registro de idiomas, herencia es-DO → es (contenido idéntico     */
/*  hasta la revisión fonética Q3), semántica de la sustitución selectiva y    */
/*  coherencia del inventario de assets con el motor de voz neural            */
/*  (tools/nos/voices.json).                                                   */
/* -------------------------------------------------------------------------- */

/* Globals de Node que Jest provee (el proyecto no incluye @types/node). */
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('getVerbalBands · registro por idioma', () => {
  it('es devuelve el banco base (misma referencia, sin copia divergente)', () => {
    expect(getVerbalBands('es')).toBe(VERBAL_BANDS);
  });

  it('es-DO existe estructuralmente y hereda del español base (Q1.3)', () => {
    const esDo = getVerbalBands('es-DO');
    expect(esDo).toHaveLength(VERBAL_BANDS.length);
    for (let i = 0; i < esDo.length; i++) {
      const base = VERBAL_BANDS[i];
      const variant = esDo[i];
      expect(variant.band).toBe(base.band);
      expect(variant.modality).toBe(base.modality);
      expect(variant.optionsPerCard).toBe(base.optionsPerCard);
      // ids globales estables: la variante nunca renumera.
      expect(variant.items.map(it => it.id)).toEqual(base.items.map(it => it.id));
      // Sin overrides firmados (Q3.3 pendiente), el contenido es idéntico.
      expect(variant.items).toEqual(base.items);
    }
    expect(ES_DO_ITEM_OVERRIDES).toHaveLength(0);
  });

  it('gl tiene banco PROPIO (plan Nós M3), no una copia del castellano', () => {
    const gl = getVerbalBands('gl');
    expect(gl).toHaveLength(VERBAL_BANDS.length);
    for (let i = 0; i < gl.length; i++) {
      expect(gl[i].band).toBe(VERBAL_BANDS[i].band);
      expect(gl[i].optionsPerCard).toBe(VERBAL_BANDS[i].optionsPerCard);
      expect(gl[i].modality).toBe(VERBAL_BANDS[i].modality);
    }
    // Contenido propio: si el gallego fuese una copia traducida palabra a
    // palabra del castellano, los pares mínimos dejarían de serlo.
    const glWords = gl.flatMap(b => b.items.map(i => i.targetWord));
    const esWords = VERBAL_BANDS.flatMap(b => b.items.map(i => i.targetWord));
    expect(glWords).not.toEqual(esWords);
    expect(glWords.some(w => !esWords.includes(w))).toBe(true);
  });

  it('los ids del banco gallego no colisionan con los del castellano', () => {
    const glIds = getVerbalBands('gl').flatMap(b => b.items.map(i => i.id));
    const esIds = VERBAL_BANDS.flatMap(b => b.items.map(i => i.id));
    expect(new Set(glIds).size).toBe(glIds.length); // únicos dentro de gl
    expect(glIds.filter(id => esIds.includes(id))).toEqual([]);
  });

  it('gl ya NO es provisional: el banco lo firmó ACOPROS (T3.3)', () => {
    expect(VERBAL_BANK_PROVISIONAL).not.toContain('gl');
  });

  it('el audio gl ya NO está pendiente: el pipeline neural lo sintetizó', () => {
    // Distinción que sigue importando: la firma del BANCO (listas, ACOPROS) y
    // la del AUDIO son cosas distintas. Lo que cambió es el hecho material —
    // el gallego ya tiene sus locuciones propias con la voz Celtia, así que el
    // aviso de «se dicta con la voz del dispositivo» sería falso.
    expect(VERBAL_AUDIO_PENDING).not.toContain('gl');
    expect(VERBAL_AUDIO_PENDING).not.toContain('eu');
    expect(VERBAL_AUDIO_PENDING).not.toContain('es');
    expect(VERBAL_AUDIO_PENDING).not.toContain('es-DO');
  });

  it('todo idioma registrado con recortes propios es alcanzable desde la app', () => {
    // Que la lista esté vacía tiene que corresponderse con recortes REALES en
    // disco: si alguien la vacía sin sintetizar, la pantalla deja de advertir
    // que se dicta con la voz del sistema y el profesional no se entera.
    for (const lang of VERBAL_BANK_LANGS) {
      if (VERBAL_AUDIO_PENDING.includes(lang)) continue;
      // Un banco PRESTADO no tiene recortes propios ni debe tenerlos: sus
      // palabras son de otra lengua y suenan con la voz de esa lengua.
      if (VERBAL_BANK_BORROWED[lang]) continue;
      const dir = path.join(
        ROOT, 'assets', 'audio', 'verbal', ...(lang === 'es' ? [] : [lang]),
      );
      const keys = new Set<string>();
      for (const band of getVerbalBands(lang)) {
        for (const item of band.items) keys.add(item.audio);
      }
      const missing = [...keys].filter(k => !fs.existsSync(path.join(dir, `${k}.m4a`)));
      expect({ lang, missing }).toEqual({ lang, missing: [] });
    }
  });

  it('un idioma sin banco registrado falla explícitamente', () => {
    expect(() => getVerbalBands('fr')).toThrow(/no registrado/);
    expect(() => getVerbalBands('')).toThrow(/no registrado/);
  });

  it('resolveVerbalLang degrada a es en vez de dejar caer la pantalla', () => {
    // Regresión: la pantalla abría el banco con el idioma de sesión sin
    // sanear; un código sin banco (p. ej. `en`) lanzaba en el primer render y
    // la audiometría verbal «no funcionaba» sin más explicación.
    expect(resolveVerbalLang('gl')).toBe('gl');
    expect(resolveVerbalLang('es-DO')).toBe('es-DO');
    expect(resolveVerbalLang('en')).toBe('en');
    expect(resolveVerbalLang('fr')).toBe('es');
    expect(resolveVerbalLang(null)).toBe('es');
    expect(resolveVerbalLang(undefined)).toBe('es');
    expect(() => getVerbalBands(resolveVerbalLang('cualquier-cosa'))).not.toThrow();
  });

  it('todo idioma registrado declara su base de herencia', () => {
    for (const lang of VERBAL_BANK_LANGS) {
      expect(VERBAL_BANK_BASE[lang] !== undefined).toBe(true);
      const base = VERBAL_BANK_BASE[lang];
      if (base) expect(VERBAL_BANK_LANGS).toContain(base);
    }
  });
});

describe('buildEsDoBands · semántica de la sustitución selectiva (Q3)', () => {
  // Lámina real de la banda C (pares mínimos con imagen) para el ensayo.
  const sample = VERBAL_BANDS.find(b => b.band === 'C')!.items[1];

  it('una sustitución reemplaza palabras y claves de asset conservando id/banda/práctica', () => {
    const words = ['perro', 'cerro', 'berro', 'gorro', 'morro', 'forro'];
    const bands = buildEsDoBands([{ id: sample.id, words, reason: 'ensayo de fusión' }]);
    const item = bands.flatMap(b => b.items).find(it => it.id === sample.id)!;
    expect(item.targetWord).toBe('perro');
    expect(item.audio).toBe('perro');
    expect(item.band).toBe(sample.band);
    expect(!!item.practice).toBe(!!sample.practice);
    expect(item.options.map(o => o.word)).toEqual(words);
    // La lámina base tenía imágenes → la sustituta también (claves nuevas propias).
    expect(item.options.every(o => !!o.image)).toBe(true);
    // El resto del banco queda intacto.
    const untouched = bands.flatMap(b => b.items).filter(it => it.id !== sample.id);
    const baseUntouched = VERBAL_BANDS.flatMap(b => b.items).filter(it => it.id !== sample.id);
    expect(untouched).toEqual(baseUntouched);
  });

  it('rechaza sustituciones malformadas (aridad distinta o id duplicado)', () => {
    expect(() =>
      buildEsDoBands([{ id: sample.id, words: ['perro', 'cerro'], reason: 'aridad inválida' }]),
    ).toThrow(/opciones/);
    const words = ['perro', 'cerro', 'berro', 'gorro', 'morro', 'forro'];
    expect(() =>
      buildEsDoBands([
        { id: sample.id, words, reason: 'duplicado' },
        { id: sample.id, words, reason: 'duplicado' },
      ]),
    ).toThrow(/duplicado/);
  });
});

describe('inventario de assets por idioma (Q1.4)', () => {
  it('es: coincide con el inventario histórico y no hereda nada', () => {
    const inv = collectLangAssetInventory('es');
    const legacy = collectAssetInventory();
    expect(inv.audio).toEqual(legacy.audio);
    expect(inv.images).toEqual(legacy.images);
    expect(inv.inheritedImages).toEqual([]);
  });

  it('es-DO: audio propio (misma clave, voz dominicana) e imágenes 100 % heredables hoy', () => {
    const inv = collectLangAssetInventory('es-DO');
    const base = collectLangAssetInventory('es');
    expect(inv.audio).toEqual(base.audio);
    expect(inv.images).toEqual(base.images);
    // Sin overrides, toda ilustración se hereda de es sin duplicar archivos.
    expect(inv.inheritedImages).toEqual(inv.images);
  });
});

describe('coherencia con el motor de voz neural (tools/nos/voices.json)', () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'tools', 'nos', 'voices.json'), 'utf8'),
  );

  it('todo idioma con banco registrado tiene una voz neural declarada', () => {
    for (const lang of VERBAL_BANK_LANGS) {
      expect({ lang, voice: !!registry.voices[lang] }).toEqual({ lang, voice: true });
    }
  });

  it('las voces declaran motor conocido, modelo, origen y estado de aprobación', () => {
    for (const [lang, cfg] of Object.entries<any>(registry.voices)) {
      // `ahotts`: el euskera no se infiere como un VITS suelto — su ONNX espera
      // fonemas y los produce el frontend lingüístico vasco de AhoTTS.
      expect({ lang, engine: ['piper', 'coqui-vits', 'ahotts', 'matxa'].includes(cfg.engine) })
        .toEqual({ lang, engine: true });
      expect(typeof cfg.model).toBe('string');
      expect(typeof cfg.source).toBe('string');
      // El booleano `provisional` desapareció cuando el registro pasó a declarar
      // la aprobación clínica completa (quién firma, cuándo y sobre qué acta);
      // la prueba se quedó comprobando el campo viejo y llevaba roja desde
      // entonces. El estado vive ahora en `clinicalApproval`.
      expect({ lang, aprobacion: typeof cfg.clinicalApproval?.status })
        .toEqual({ lang, aprobacion: 'string' });
      // Cada voz debe declarar DE DÓNDE sale (portada de Valeria+ o elegida
      // aquí): es lo que impide volver a dar por buena una voz sin contrastar.
      expect(typeof cfg.origin).toBe('string');
    }
  });

  it('gl (plan Nós) tiene la voz Celtia registrada para locutar su banco', () => {
    expect(registry.voices.gl.model).toBe('proxectonos/Nos_TTS-celtia-vits-graphemes');
    expect(registry.voices.gl.engine).toBe('coqui-vits');
  });

  it('eu tiene la voz Maider de HiTZ, con su respaldo y su cadena AhoTTS', () => {
    const eu = registry.voices.eu;
    expect(eu.model).toBe('maider');
    // El motor NO es `coqui-vits`: el vits.onnx vasco espera FONEMAS, que
    // produce el binario de AhoTTS con el diccionario eu_dicc. Tratarlo como
    // un VITS de grafemas (que es lo que sí es Celtia) da audio inservible.
    expect(eu.engine).toBe('ahotts');
    expect(eu.toolchain).toContain('aHoTTS');
    // Voz femenina Maider y respaldo masculino Antton, en ese orden.
    expect(eu.hfRepos).toEqual(['HiTZ/TTS-eu_maider', 'HiTZ/TTS-eu_antton']);
    expect(eu.license).toContain('CC BY 4.0');
  });

  /* ------------------------------------------------------------------ */
  /*  LICENCIAS Y MOTORES: lo que Valeria+ ya auditó, y aquí se incumplió. */
  /* ------------------------------------------------------------------ */

  it('el inglés NO usa una voz descartada por licencia', () => {
    // Valeria+ auditó rhasspy/piper-voices VOZ POR VOZ (no es uniforme):
    //   · en_US-hfc_female-medium → Hi-Fi Captain, CC BY-NC-SA ⇒ NO comercial.
    //   · en_US-lessac-medium     → Blizzard Challenge, licencia de investigación.
    //   · en_US-ljspeech-high     → LibriVox dominio público + modelo MIT. ✅
    // VIA+ declaraba `lessac` y lo etiquetaba «Public Domain»: las dos cosas
    // eran falsas, en un producto Clase IIa. Este test es lo que impide que
    // vuelva por descuido.
    const prohibidas = ['lessac', 'hfc_female'];
    for (const mala of prohibidas) {
      expect({ mala, usada: registry.voices.en.model.includes(mala) })
        .toEqual({ mala, usada: false });
    }
    expect(registry.voices.en.model).toBe('en_US-ljspeech-high');
  });

  it('el catalán usa Matxa-TTS de AINA, que es lo demostrado en Valeria+', () => {
    // No es Piper: es Matcha-TTS con el vocóder dentro del export y frontend
    // fonémico. Declararlo como piper no da error, da ruido.
    const ca = registry.voices.ca;
    expect(ca.engine).toBe('matxa');
    expect(ca.hfRepos[0]).toContain('projecte-aina');
  });

  it('toda voz declara dónde están sus pesos: ni un `files` nulo', () => {
    // `ca`, `es-419` y `en` entraron con `files: null`, así que el motor Piper
    // reventaba al construirse (`base / cfg["files"]["onnx"]`). Estaban
    // declaradas, no cableadas — y nada lo decía.
    for (const [lang, cfg] of Object.entries<any>(registry.voices)) {
      expect({ lang, files: !!cfg.files && Object.keys(cfg.files).length > 0 })
        .toEqual({ lang, files: true });
    }
  });

  it('toda voz VITS declara sus repositorios de pesos por orden de preferencia', () => {
    for (const [lang, cfg] of Object.entries<any>(registry.voices)) {
      if (cfg.engine === 'piper') continue; // los Piper se resuelven por URL directa
      expect({ lang, repos: Array.isArray(cfg.hfRepos) && cfg.hfRepos.length > 0 })
        .toEqual({ lang, repos: true });
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Trazabilidad de la aprobación clínica.                                     */
/*                                                                             */
/*  VIA+ es un SaMD: que un banco deje de estar marcado como provisional en el */
/*  código tiene que corresponderse con un REGISTRO de aprobación en disco, no */
/*  con la memoria de quien editó la constante. Estas pruebas atan las dos     */
/*  cosas en ambos sentidos.                                                    */
/* -------------------------------------------------------------------------- */

describe('aprobación clínica · el código no puede adelantarse al registro', () => {
  const approvalPath = (lang: string) =>
    path.join(ROOT, 'assets', `verbal-approval.${lang}.json`);
  const approvalsOf = (lang: string): any[] => {
    const p = approvalPath(lang);
    if (!fs.existsSync(p)) return [];
    return [JSON.parse(fs.readFileSync(p, 'utf8'))].flat();
  };
  const scopeOf = (a: any) => a.scope ?? 'audio';

  it('todo idioma NO provisional distinto de es tiene registro de aprobación del banco', () => {
    for (const lang of VERBAL_BANK_LANGS) {
      if (lang === 'es' || VERBAL_BANK_PROVISIONAL.includes(lang)) continue;
      // es-DO hereda el banco castellano sin sustituciones: su validación es
      // la del castellano y no necesita registro propio.
      if (VERBAL_BANK_BASE[lang] === 'es') continue;
      const bank = approvalsOf(lang).filter(a => scopeOf(a) === 'bank');
      expect({ lang, tieneRegistro: bank.length === 1 }).toEqual({ lang, tieneRegistro: true });
      expect(bank[0].status).toBe('aprobado-produccion');
      expect(bank[0].approvedBy?.trim()).toBeTruthy();
      expect(bank[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('gl: banco y audio son DOS firmas, y la del banco excluye el audio', () => {
    const approvals = approvalsOf('gl');
    // La firma del banco (28/07, listas) es anterior a la del audio (31/07,
    // voz Celtia). Que ahora convivan las dos no borra la distinción: cada
    // artefacto se firma por separado y en su momento.
    expect(approvals.map(scopeOf).sort()).toEqual(['audio', 'bank']);
    const bank = approvals.find(a => scopeOf(a) === 'bank');
    expect(bank.approvedBy).toBe('ACOPROS');
    // El registro del banco debe decir qué NO cubre: se firmó cuando las
    // locuciones ni siquiera existían, y sin ese `excludes` un lector futuro
    // podría darlas por aprobadas de rebote.
    expect(Array.isArray(bank.excludes)).toBe(true);
    expect(bank.excludes.join(' ')).toMatch(/locuciones/i);
  });

  it('las cuatro lenguas tienen UNA firma de AUDIO vigente, con la receta de la voz', () => {
    // Lo aprobado no es un lote de bytes sino la voz CON SU RECETA: sin el
    // modelo y los parámetros escritos, regenerar con otra voz heredaría la
    // firma en silencio.
    //
    // Las firmas RETIRADAS (`superseded`) se quedan en el registro a propósito
    // —el castellano conserva la de davefx— para que el expediente cuente por
    // qué se cambió de voz. La prueba contaba todas y llevaba roja desde que se
    // retiró davefx: lo que debe haber una y solo una es la firma VIGENTE.
    for (const lang of VERBAL_BANK_LANGS) {
      if (VERBAL_AUDIO_PENDING.includes(lang)) continue;
      // Un banco PRESTADO no firma audio propio: no lo tiene. Lo que suena es
      // la locución de la lengua que le presta las palabras, y esa ya está
      // firmada en SU expediente.
      if (VERBAL_BANK_BORROWED[lang]) continue;
      const audio = approvalsOf(lang).filter(a => scopeOf(a) === 'audio');
      const vigentes = audio.filter(a => a.status !== 'superseded');
      expect({ lang, firmas: vigentes.length }).toEqual({ lang, firmas: 1 });
      expect(vigentes[0].status).toBe('aprobado-produccion');
      expect(vigentes[0].appliesTo).toBe('voice');
      expect(vigentes[0].recipe?.model?.trim()).toBeTruthy();
      expect(typeof vigentes[0].recipe?.lengthScale).toBe('number');
      // Una firma retirada tiene que decir qué la sustituye y por qué, o el
      // registro deja de ser trazable.
      for (const retirada of audio.filter(a => a.status === 'superseded')) {
        expect(retirada.supersededBy?.trim()).toBeTruthy();
        expect(retirada.supersededReason?.trim()).toBeTruthy();
      }
    }
  });

  it('eu ya NO es provisional: la logopeda euskaldun de Ulertuz firmó el banco', () => {
    expect(VERBAL_BANK_PROVISIONAL).not.toContain('eu');
    const bank = approvalsOf('eu').filter(a => scopeOf(a) === 'bank');
    expect(bank).toHaveLength(1);
    expect(bank[0].approvedBy).toMatch(/Ulertuz/);
  });

  it('un idioma con audio pendiente NO tiene registro de aprobación de audio', () => {
    for (const lang of VERBAL_AUDIO_PENDING) {
      const audio = approvalsOf(lang).filter(a => scopeOf(a) === 'audio');
      expect({ lang, audioAprobado: audio.length }).toEqual({ lang, audioAprobado: 0 });
    }
  });

  it('el banco firmado coincide en tamaño con el que se compila (la firma no queda huérfana)', () => {
    const items = getVerbalBands('gl').flatMap(b => b.items);
    const scored = items.filter(i => !i.practice);
    const bank = approvalsOf('gl').find(a => scopeOf(a) === 'bank');
    expect(bank.bank).toContain(`${items.length} láminas`);
    expect(bank.bank).toContain(`${scored.length} puntuables`);
  });
});
