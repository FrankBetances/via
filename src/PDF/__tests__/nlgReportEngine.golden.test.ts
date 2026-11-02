import type { UiLang } from '@/I18n/uiLang';
import { evaluateSessionNlg, isNlgCatalogReady, type SessionEntities } from '@/PDF/nlgReportEngine';

/* -------------------------------------------------------------------------- */
/*  Oro de una sesión limpia. es, es-419 y es-DO comparten el castellano      */
/*  peninsular (las dos variedades son un delta sobre ES). gl, eu, ca y en    */
/*  narran en su bloque: mismas reglas y su propio texto exacto, estable en   */
/*  cincuenta corridas.                                                       */
/* -------------------------------------------------------------------------- */

const mchat = (): Record<number, boolean> => {
  const answers: Record<number, boolean> = {};
  for (let i = 1; i <= 20; i++) answers[i] = false;
  return answers;
};

const archetype = (): SessionEntities => {
  const ear = { 500: 10, 1000: 10, 2000: 10, 4000: 10 };
  return {
    clinicalAssessments: [{ id: 1, instrument: 'CAP', globalResult: 'FULL', domains: null } as never],
    audiometries: [
      {
        id: 1,
        transducer: 'air',
        thresholds: { OD: ear, OI: { ...ear } },
        ptaOD: null,
        ptaOI: null,
      } as never,
    ],
    verbalAudiometries: [
      {
        id: 1,
        ageBand: 'D',
        language: 'es',
        presentedCount: 10,
        correctCount: 9,
        levelScores: [{ level: 65, presented: 10, correct: 9, pct: 90 }],
        srtDb: null,
      } as never,
    ],
    voiceAnalyses: [
      {
        id: 1,
        f0: 250,
        jitter: 0.5,
        shimmer: 2,
        hnr: 18,
        formants: { f1: 500, f2: 1500, f3: 2500 },
        grbas: null,
      } as never,
    ],
    prosodyAnalyses: [
      {
        id: 1,
        reason: 'ok',
        metrics: {
          spanSec: 4,
          syllableCount: 12,
          pauseCount: 1,
          f0RangeSt: 5,
          speechRateSps: 3,
          articulationRateSps: 4,
        },
      } as never,
    ],
    articulations: [
      {
        id: 1,
        evaluatedCount: 8,
        totalCount: 10,
        correctPct: 80,
        sodaCounts: { S: 1, O: 0, D: 0, A: 0 },
        affectedPhonemes: [],
        phonemeStatus: [],
      } as never,
    ],
    ashaTests: [{ id: 'a', ageBand: 'C', riskLevel: 'green', failedDomains: [] } as never],
    screenings: [
      { id: 1, instrument: 'autism-tea', score: 0, total: 20, answers: mchat() } as never,
    ],
    dysphagias: [
      {
        id: 1,
        safetyAltered: false,
        efficacyAltered: false,
        minSpO2: 98,
        maxDrop: 0,
        recommendation: 'mantener',
        bolus: [{}],
      } as never,
    ],
    sahsScreenings: [
      {
        id: 1,
        psqYesCount: 1,
        psqTotal: 13,
        brodsky: 1,
        imc: 'normo',
        suspicionLevel: 'low',
      } as never,
    ],
    executiveFunctions: [
      {
        id: 1,
        ageBand: 'B',
        attentionScore: 80,
        inhibitionScore: 80,
        flexibilityScore: 80,
        workingMemoryScore: 80,
        planningScore: 80,
        overallScore: 80,
      } as never,
    ],
  };
};

const GOLD_RULE_IDS = [
  'R-CAP-001',
  'R-AUD-002',
  'R-AUD-002',
  'R-VER-002',
  'R-VER-003',
  'R-VOZ-002',
  'R-VOZ-004',
  'R-PRO-002',
  'R-ART-002',
  'R-ASH-001',
  'R-AUT-002',
  'R-DYS-001',
  'R-SAH-001',
  'R-EF-002',
];

/* Texto EXACTO por lengua. gl, eu, ca y en no tienen todavía acta de revisión
 * lingüística: este oro detecta cambios, no certifica la traducción. */
const GOLD: Record<'es' | 'gl' | 'eu' | 'ca' | 'en', string> = {
  es: [
    "Síntesis clínica global",
    "Módulos con registro: 11. Avisos: 0. Hallazgos cruzados: 0. Derivaciones sugeridas: 0.",
    "",
    "Condiciones de la exploración",
    "Condiciones visuales, motoras, verbales y otoscópicas verificadas. Veredicto global del certificado de aptitud: FULL.",
    "",
    "Audición",
    "Oído derecho: PTA 10 dB HL. Umbral dentro del rango de referencia (≤ 20 dB HL). Curva plana (la diferencia entre 500 Hz y 4000 Hz es menor de 15 dB).",
    "Oído izquierdo: PTA 10 dB HL. Umbral dentro del rango de referencia (≤ 20 dB HL). Curva plana (la diferencia entre 500 Hz y 4000 Hz es menor de 15 dB).",
    "Audiometría verbal, banda D: reconocimiento 90 % (9/10) a 65 dB. URV/SRT estimado: no disponible.",
    "Variante lingüística registrada: es.",
    "",
    "Voz",
    "Parámetros medidos en esta toma: F0 250 Hz, jitter local ciclo a ciclo 0,5 %, shimmer local ciclo a ciclo 2 %, HNR 18 dB. Formantes F1–F3: 500, 1500, 2500. Parámetros acústicos registrados dentro de los intervalos de referencia orientativos para voz pediátrica en esta toma (F0, jitter, shimmer y HNR sin desvíos por encima del umbral de alerta).",
    "La estimación ciclo a ciclo del shimmer comprime la cifra entre 1,3 y 1,7 veces respecto a Praat. Los formantes F1–F3 de esta toma están registrados.",
    "Registro descriptivo de habla conectada: duración 4 s; núcleos silábicos: 12; pausas: 1; rango tonal: 5 semitonos; velocidad de habla / de articulación: 3 / 4 sílabas/s. No hay baremo poblacional de referencia para estas medidas. La lectura corresponde al profesional.",
    "",
    "Lenguaje y articulación",
    "T.A.R.: 8 de 10 ítems evaluados, 80 % de producción concordante. Desglose SODA (sustitución, omisión, distorsión, adición): S 1, O 0, D 0, A 0.",
    "",
    "Comunicación y neurodesarrollo",
    "Banda C: hitos contestados cumplidos en el cribado ASHA.",
    "M-CHAT-R: puntuación 0 sobre 20, banda baja (0–2). La puntuación queda por debajo de 3.",
    "Funciones ejecutivas, banda B: índice global 80/100. Dominios completados: (5/5) atención 80/100, inhibición 80/100, flexibilidad cognitiva 80/100, memoria de trabajo 80/100, planificación 80/100. Puntuaciones iguales o superiores al umbral orientativo (≥ 65/100) en los dominios completados.",
    "",
    "Deglución y sueño",
    "MECV-V: sin signos de compromiso de eficacia ni de seguridad en los bolos evaluados.",
    "PSQ de Chervin: 1 de 13 respuestas afirmativas. Grado amigdalar de Brodsky: 1. IMC en el intervalo de referencia. Sospecha orientativa: baja. La confirmación corresponde a una polisomnografía en Unidad de Sueño.",
    "",
    "Aviso SaMD Clase IIa. El texto describe medidas y desvíos respecto a umbrales de referencia. La decisión clínica corresponde al profesional presente.",
  ].join('\n'),
  gl: [
    "Síntese clínica global",
    "Módulos con rexistro: 11. Avisos: 0. Achados cruzados: 0. Derivacións suxeridas: 0.",
    "",
    "Condicións da exploración",
    "Condicións visuais, motoras, verbais e otoscópicas verificadas. Veredicto global do certificado de aptitude: FULL.",
    "",
    "Audición",
    "Oído dereito: PTA 10 dB HL. Limiar dentro do rango de referencia (≤ 20 dB HL). Curva plana (a diferenza entre 500 Hz e 4000 Hz é menor de 15 dB).",
    "Oído esquerdo: PTA 10 dB HL. Limiar dentro do rango de referencia (≤ 20 dB HL). Curva plana (a diferenza entre 500 Hz e 4000 Hz é menor de 15 dB).",
    "Audiometría verbal, banda D: recoñecemento 90 % (9/10) a 65 dB. URV/SRT estimado: non dispoñible.",
    "Variante lingüística rexistrada: es.",
    "",
    "Voz",
    "Parámetros medidos nesta toma: F0 250 Hz, jitter local ciclo a ciclo 0,5 %, shimmer local ciclo a ciclo 2 %, HNR 18 dB. Formantes F1–F3: 500, 1500, 2500. Parámetros acústicos rexistrados dentro dos intervalos de referencia orientativos para voz pediátrica nesta toma (F0, jitter, shimmer e HNR sen desvíos por riba do limiar de alerta).",
    "A estimación ciclo a ciclo do shimmer comprime a cifra entre 1,3 e 1,7 veces respecto de Praat. Os formantes F1–F3 desta toma están rexistrados.",
    "Rexistro descritivo de fala conectada: duración 4 s; núcleos silábicos: 12; pausas: 1; rango tonal: 5 semitonos; velocidade de fala / de articulación: 3 / 4 sílabas/s. Non hai baremo poboacional de referencia para estas medidas. A lectura corresponde ao profesional.",
    "",
    "Linguaxe e articulación",
    "T.A.R.: 8 de 10 ítems avaliados, 80 % de produción concordante. Desagregación SODA (substitución, omisión, distorsión, adición): S 1, O 0, D 0, A 0.",
    "",
    "Comunicación e neurodesenvolvemento",
    "Banda C: fitos contestados cumpridos no cribado ASHA.",
    "M-CHAT-R: puntuación 0 sobre 20, banda baixa (0–2). A puntuación queda por debaixo de 3.",
    "Funcións executivas, banda B: índice global 80/100. Dominios completados: (5/5) atención 80/100, inhibición 80/100, flexibilidade cognitiva 80/100, memoria de traballo 80/100, planificación 80/100. Puntuacións iguais ou superiores ao limiar orientativo (≥ 65/100) nos dominios completados.",
    "",
    "Deglutición e sono",
    "MECV-V: sen signos de compromiso de eficacia nin de seguridade nos bolos avaliados.",
    "PSQ de Chervin: 1 de 13 respostas afirmativas. Grao amigdalar de Brodsky: 1. IMC no intervalo de referencia. Sospeita orientativa: baixa. A confirmación corresponde a unha polisomnografía na Unidade do Sono.",
    "",
    "Aviso SaMD Clase IIa. O texto describe medidas e desvíos respecto dos limiares de referencia. A decisión clínica corresponde ao profesional presente.",
  ].join('\n'),
  eu: [
    "Sintesi kliniko orokorra",
    "Erregistroa duten moduluak: 11. Abisuak: 0. Aurkikuntza gurutzatuak: 0. Iradokitako deribazioak: 0.",
    "",
    "Azterketaren baldintzak",
    "Ikusmeneko, motorraren, hitzezko eta otoskopiako baldintzak egiaztatuta daude. Gaitasun-ziurtagiriaren epai orokorra: FULL.",
    "",
    "Entzumena",
    "Eskuineko belarria: PTA 10 dB HL. Erreferentzia-tartearen barruko atalasea (≤ 20 dB HL). Kurba laua (500 Hz eta 4000 Hz arteko aldea 15 dB baino txikiagoa da).",
    "Ezkerreko belarria: PTA 10 dB HL. Erreferentzia-tartearen barruko atalasea (≤ 20 dB HL). Kurba laua (500 Hz eta 4000 Hz arteko aldea 15 dB baino txikiagoa da).",
    "Hitzezko audiometria, D banda: errekonozimendua 90 % (9/10) 65 dB-tan. Estimaturiko URV/SRT: ez dago erabilgarri.",
    "Erregistratutako hizkuntza-aldaera: es.",
    "",
    "Ahotsa",
    "Hartune honetan neurtutako parametroak: F0 250 Hz, zikloz zikloko jitter lokala 0,5 %, zikloz zikloko shimmer lokala 2 %, HNR 18 dB. F1–F3 formanteak: 500, 1500, 2500. Erregistratutako parametro akustikoak haur-ahotsaren erreferentzia-tarte orientagarrien barruan daude hartune honetan (F0, jitter, shimmer eta HNR alerta-atalasetik gora desbideratu gabe).",
    "Shimmer-en zikloz zikloko estimazioak zifra 1,3 eta 1,7 aldiz konprimitzen du Praaten aldean. Hartune honetako F1–F3 formanteak erregistratuta daude.",
    "Hizketa jarraituaren erregistro deskribatzailea: iraupena 4 s; silaba-nukleoak: 12; isiluneak: 1; tonu-bitartea: 5 tonuerdi; hizketa- / artikulazio-abiadura: 3 / 4 silaba/s. Neurri hauetarako ez dago populazio-erreferentziarik. Irakurketa profesionalari dagokio.",
    "",
    "Hizkuntza eta artikulazioa",
    "T.A.R.: 10 itemetik 8 ebaluatuta, ekoizpen bat-etortzailea 80 %. SODA banaketa (ordezkapena, omisioa, distortsioa, gehikuntza): S 1, O 0, D 0, A 0.",
    "",
    "Komunikazioa eta neurogarapena",
    "C banda: erantzundako mugarriak beteta daude ASHA baheketan.",
    "M-CHAT-R: puntuazioa 20tik 0, baxua (0–2) banda. Puntuazioa 3tik behera dago.",
    "Funtzio exekutiboak, B banda: indize orokorra 80/100. Osatutako domeinuak: (5/5) arreta 80/100, inhibizioa 80/100, malgutasun kognitiboa 80/100, laneko memoria 80/100, plangintza 80/100. Osatutako domeinuetan puntuazioak orientazio-atalasearen berdina edo handiagoa (≥ 65/100).",
    "",
    "Irenstea eta loa",
    "MECV-V: ebaluatutako boloetan ez dago eraginkortasun-arriskurik, ezta segurtasun-arriskurik ere.",
    "Chervinen PSQ: 13 erantzunetatik 1 baiezko. Brodskyren amigdala-gradua: 1. GMI erreferentzia-tartean. Susmo orientagarria: baxua. Berrespena Loaren Unitateko polisomnografiari dagokio.",
    "",
    "SaMD IIa Klasearen oharra. Testuak neurriak eta erreferentzia-atalaseekiko desbideratzeak deskribatzen ditu. Erabaki klinikoa bertan den profesionalari dagokio.",
  ].join('\n'),
  ca: [
    "Síntesi clínica global",
    "Mòduls amb registre: 11. Avisos: 0. Troballes creuades: 0. Derivacions suggerides: 0.",
    "",
    "Condicions de l’exploració",
    "Condicions visuals, motores, verbals i otoscòpiques verificades. Veredicte global del certificat d’aptitud: FULL.",
    "",
    "Audició",
    "Orella dreta: PTA 10 dB HL. Llindar dins del rang de referència (≤ 20 dB HL). Corba plana (la diferència entre 500 Hz i 4000 Hz és menor de 15 dB).",
    "Orella esquerra: PTA 10 dB HL. Llindar dins del rang de referència (≤ 20 dB HL). Corba plana (la diferència entre 500 Hz i 4000 Hz és menor de 15 dB).",
    "Audiometria verbal, banda D: reconeixement 90 % (9/10) a 65 dB. URV/SRT estimat: no disponible.",
    "Variant lingüística registrada: es.",
    "",
    "Veu",
    "Paràmetres mesurats en aquesta presa: F0 250 Hz, jitter local cicle a cicle 0,5 %, shimmer local cicle a cicle 2 %, HNR 18 dB. Formants F1–F3: 500, 1500, 2500. Paràmetres acústics registrats dins dels intervals de referència orientatius per a veu pediàtrica en aquesta presa (F0, jitter, shimmer i HNR sense desviacions per sobre del llindar d’alerta).",
    "L’estimació cicle a cicle del shimmer comprimeix la xifra entre 1,3 i 1,7 vegades respecte de Praat. Els formants F1–F3 d’aquesta presa estan registrats.",
    "Registre descriptiu de parla connectada: durada 4 s; nuclis sil·làbics: 12; pauses: 1; rang tonal: 5 semitons; velocitat de parla / d’articulació: 3 / 4 síl·labes/s. No hi ha barem poblacional de referència per a aquestes mesures. La lectura correspon al professional.",
    "",
    "Llenguatge i articulació",
    "T.A.R.: 8 de 10 ítems avaluats, 80 % de producció concordant. Desglossament SODA (substitució, omissió, distorsió, addició): S 1, O 0, D 0, A 0.",
    "",
    "Comunicació i neurodesenvolupament",
    "Banda C: fites contestades complertes en el cribratge ASHA.",
    "M-CHAT-R: puntuació 0 sobre 20, banda baixa (0–2). La puntuació queda per sota de 3.",
    "Funcions executives, banda B: índex global 80/100. Dominis completats: (5/5) atenció 80/100, inhibició 80/100, flexibilitat cognitiva 80/100, memòria de treball 80/100, planificació 80/100. Puntuacions iguals o superiors al llindar orientatiu (≥ 65/100) en els dominis completats.",
    "",
    "Deglució i son",
    "MECV-V: sense signes de compromís d’eficàcia ni de seguretat en els bols avaluats.",
    "PSQ de Chervin: 1 de 13 respostes afirmatives. Grau amigdalar de Brodsky: 1. IMC en l’interval de referència. Sospita orientativa: baixa. La confirmació correspon a una polisomnografia a la Unitat del Son.",
    "",
    "Avís SaMD Classe IIa. El text descriu mesures i desviacions respecte dels llindars de referència. La decisió clínica correspon al professional present.",
  ].join('\n'),
  en: [
    "Overall clinical synthesis",
    "Modules recorded: 11. Warnings: 0. Cross findings: 0. Suggested referrals: 0.",
    "",
    "Examination conditions",
    "Visual, motor, verbal and otoscopy conditions checked. Overall fitness-certificate verdict: FULL.",
    "",
    "Hearing",
    "Right ear: PTA 10 dB HL. Threshold inside the reference range (≤ 20 dB HL). Flat curve (the difference between 500 Hz and 4000 Hz is under 15 dB).",
    "Left ear: PTA 10 dB HL. Threshold inside the reference range (≤ 20 dB HL). Flat curve (the difference between 500 Hz and 4000 Hz is under 15 dB).",
    "Speech audiometry, band D: recognition 90 % (9/10) at 65 dB. Estimated SRT/URV: not available.",
    "Recorded language variant: es.",
    "",
    "Voice",
    "Parameters measured in this take: F0 250 Hz, cycle-to-cycle local jitter 0.5 %, cycle-to-cycle local shimmer 2 %, HNR 18 dB. Formants F1–F3: 500, 1500, 2500. Acoustic parameters recorded in this take sit inside the indicative reference intervals for pediatric voice (F0, jitter, shimmer and HNR with no deviations above the alert threshold).",
    "The cycle-to-cycle shimmer estimate compresses the figure between 1.3 and 1.7 times relative to Praat. Formants F1–F3 for this take are recorded.",
    "Descriptive record of connected speech: duration 4 s; syllabic nuclei: 12; pauses: 1; pitch range: 5 semitones; speech / articulation rate: 3 / 4 syllables/s. There is no population reference scale for these measures. Reading them belongs to the professional.",
    "",
    "Language and articulation",
    "T.A.R.: 8 of 10 items scored, 80 % concordant production. SODA breakdown (substitution, omission, distortion, addition): S 1, O 0, D 0, A 0.",
    "",
    "Communication and neurodevelopment",
    "Band C: answered milestones met on the ASHA screening.",
    "M-CHAT-R: score 0 out of 20, band low (0–2). The score is below 3.",
    "Executive functions, band B: global index 80/100. Completed domains: (5/5) attention 80/100, inhibition 80/100, cognitive flexibility 80/100, working memory 80/100, planning 80/100. Scores at or above the indicative threshold (≥ 65/100) in the completed domains.",
    "",
    "Swallowing and sleep",
    "MECV-V: no signs of efficacy or safety concern in the boluses assessed.",
    "Chervin PSQ: 1 of 13 affirmative answers. Brodsky tonsil grade: 1. BMI in the reference interval. Indicative suspicion: low. Confirmation belongs to polysomnography in a Sleep Unit.",
    "",
    "SaMD Class IIa notice. The text describes measurements and deviations from reference thresholds. The clinical decision belongs to the professional present.",
  ].join('\n'),
};

const GOLD_ES = GOLD.es;

const repeat = (lang: UiLang) => {
  const first = evaluateSessionNlg(archetype(), lang);
  for (let i = 0; i < 49; i++) {
    const again = evaluateSessionNlg(archetype(), lang);
    expect(again.formattedReportText).toBe(first.formattedReportText);
    expect(again.ruleIds).toEqual(first.ruleIds);
  }
  return first;
};

describe('oro NLG', () => {
  it('castellano peninsular: mismas reglas y el mismo texto cincuenta veces', () => {
    const report = repeat('es');
    expect(report.unavailableReason).toBeNull();
    expect(report.ruleIds).toEqual(GOLD_RULE_IDS);
    expect(report.formattedReportText).toBe(GOLD_ES);
  });

  it('es-419 y es-DO repiten el oro peninsular byte a byte', () => {
    const es = evaluateSessionNlg(archetype(), 'es');
    for (const lang of ['es-419', 'es-DO'] as const) {
      expect(isNlgCatalogReady(lang)).toBe(true);
      const report = repeat(lang);
      expect(report.formattedReportText).toBe(es.formattedReportText);
      expect(report.ruleIds).toEqual(es.ruleIds);
    }
  });

  it('gl, eu, ca y en: mismas reglas y su texto exacto, cincuenta veces', () => {
    for (const lang of ['gl', 'eu', 'ca', 'en'] as const) {
      expect(isNlgCatalogReady(lang)).toBe(true);
      const report = repeat(lang);
      expect(report.unavailableReason).toBeNull();
      expect(report.ruleIds).toEqual(GOLD_RULE_IDS);
      expect(report.formattedReportText).toBe(GOLD[lang]);
      expect(report.formattedReportText).not.toBe(GOLD_ES);
    }
  });
});
