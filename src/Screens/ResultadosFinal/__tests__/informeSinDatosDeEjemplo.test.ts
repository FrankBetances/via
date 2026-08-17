import { describePatient } from '@/Helpers/patientHeader';

/**
 * INVARIANTES DEL INFORME: ni pacientes ni resultados de ejemplo, y la batería
 * entera dentro del informe.
 *
 * Esta prueba existe por un desvío concreto. Al rediseñar las pantallas a
 * tableta 4:3 se copiaron al código los datos del render de referencia: un
 * paciente inventado («Mateo B. · 5 años · NHC-48920») en la cabecera de las
 * tres pantallas de sesión, y un juego de resultados fabricados («Normal, 15 dB
 * HL bilateral») que se pintaba cuando la evaluación no traía datos. En una
 * tableta, un informe de ejemplo es indistinguible de uno real.
 *
 * En el mismo rediseño el informe pasó de ocho módulos a cuatro: audiometría
 * verbal, cribado SAHS, M-CHAT y disfagia dejaron de llegar a Resultados
 * Definitivos aunque sus módulos seguían guardando resultados.
 *
 * Se comprueba sobre el FUENTE porque lo que se fija es que esos datos no
 * vuelvan a escribirse, no el resultado de un render concreto.
 */

/* El proyecto no incluye @types/node (tipado RN puro): los globals de Node que
 * Jest sí provee se declaran localmente, igual que en verbalAssets.test.ts. */
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const SCREENS = path.resolve(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(SCREENS, p), 'utf8');

const PANTALLAS_DE_SESION = [
  'SeleccionEjercicios/SeleccionEjerciciosScreen.tsx',
  'ResultadosPreliminares/ResultadosPreliminaresScreen.tsx',
  'ResultadosFinal/ResultadosFinalScreen.tsx',
];

describe('informe y hub · sin datos de ejemplo', () => {
  it.each(PANTALLAS_DE_SESION)('%s no lleva el paciente del mockup', file => {
    const src = read(file);
    expect(src).not.toMatch(/Mateo/);
    expect(src).not.toMatch(/48920/);
    // La vista de paciente no tiene fecha de nacimiento: cualquier edad
    // escrita a mano en la cabecera es inventada.
    expect(src).not.toMatch(/patientAge\s*=\s*'/);
  });

  it('Resultados Preliminares no fabrica tarjetas de resultado', () => {
    const src = read('ResultadosPreliminares/ResultadosPreliminaresScreen.tsx');
    expect(src).not.toMatch(/-mock'/);
    expect(src).not.toMatch(/15 dB HL bilateral/);
    // El 85 % del render tampoco: sin pruebas no hay porcentaje.
    expect(src).not.toMatch(/return 85;/);
  });

  it('Resultados Definitivos no fabrica umbrales ni interpretaciones', () => {
    const src = read('ResultadosFinal/ResultadosFinalScreen.tsx');
    expect(src).not.toMatch(/-demo'/);
    expect(src).not.toMatch(/PTA OD: 13\.3/);
    // Un umbral ausente no se rellena con una audición normal.
    expect(src).not.toMatch(/thresholds\.(OD|OI)\[f\]\s*\?\?\s*\d/);
    // La interpretación y el estado se calculan.
    expect(src).toContain('interpretAudiometry(a.thresholds)');
    expect(src).toContain('buildVoiceInterpretation(');
  });

  it('la firma del informe es la del profesional de la sesión', () => {
    const src = read('ResultadosFinal/ResultadosFinalScreen.tsx');
    expect(src).not.toMatch(/272804598/);
    expect(src).toContain('activeEvaluation?.professional');
  });

  /* Las diez pruebas de la parrilla persisten en nueve repositorios (la
     audiometría infantil y la condicionada comparten tabla). Los otros dos de
     los DOCE módulos —CAP y sonómetro de sala— son prerrequisitos, no pruebas,
     y no producen tarjeta de resultado. */
  const REPOSITORIOS_DE_PRUEBA = [
    'AudiometryRepository',
    'VerbalAudiometryRepository',
    'VoiceAnalysisRepository',
    'ProsodyAnalysisRepository',
    'ArticulationTestRepository',
    'ExecutiveFunctionsRepository',
    'SahsScreeningRepository',
    'ScreeningRepository',
    'DysphagiaTestRepository',
  ];

  it('el informe recompone la batería entera', () => {
    const src = read('ResultadosFinal/ResultadosFinalScreen.tsx');
    REPOSITORIOS_DE_PRUEBA.forEach(repo => expect(src).toContain(`${repo}.get`));
  });

  it('el resumen preliminar lee los mismos módulos que el informe', () => {
    const src = read('ResultadosPreliminares/evaluationResults.ts');
    REPOSITORIOS_DE_PRUEBA.forEach(repo => expect(src).toContain(`${repo}.get`));
  });
});

describe('describePatient', () => {
  it('sin paciente lo dice, en vez de inventar uno', () => {
    expect(describePatient(null)).toEqual({
      patientLabel: 'Sin paciente asignado',
      initials: '—',
      hasPatient: false,
    });
    expect(describePatient({ name: '  ', lastName: '' }).hasPatient).toBe(false);
  });

  it('compone nombre, NHC e iniciales del paciente real', () => {
    expect(describePatient({ name: 'Lucía', lastName: 'Fernández', nhc: '10233' })).toEqual({
      patientLabel: 'Lucía Fernández · NHC-10233',
      initials: 'LF',
      hasPatient: true,
    });
  });

  it('omite el NHC cuando la sesión no lo trae', () => {
    expect(describePatient({ name: 'Lucía', lastName: 'Fernández' }).patientLabel).toBe(
      'Lucía Fernández',
    );
  });
});
