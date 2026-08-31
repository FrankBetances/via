/* -------------------------------------------------------------------------- */
/*  VIA+ · INTERFACE string catalogue · English (US)                            */
/*                                                                             */
/*  Typed against the Spanish base catalogue (`strings.es.ts`): any key added   */
/*  there and missing here breaks `npx tsc --noEmit`. That is deliberate — a    */
/*  missing string must break the build, never show up blank on a clinician's   */
/*  tablet.                                                                     */
/*                                                                             */
/*  Register: US clinical English (ASHA terminology). Sentence case in body     */
/*  copy, title case only where the Spanish uses an all-caps section label.     */
/*  SPOKEN strings do not live here (see the `strings.es.ts` header).           */
/* -------------------------------------------------------------------------- */
import { UiStrings } from './strings.es';

export const EN: UiStrings = {
  common: {
    continue: 'Continue',
    back: 'Back',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    accept: 'OK',
    loading: 'Loading…',
    retry: 'Try again',
    next: 'Next',
    finish: 'Finish',
    yes: 'Yes',
    no: 'No',
    notAvailable: 'Not available',
  },

  langPicker: {
    title: 'App language',
    subtitle: 'Your choice changes both the text and the spoken prompts across the app',
    navA11y: (label: string) => `Current language: ${label}. Tap to change language.`,
    openA11y: 'Change the app language',
    change: (code: string) => `Change language (${code})`,
    closeA11y: 'Close the language picker',
    optionA11y: (name: string, hint: string) => `${name}: ${hint}`,
    hintEs: 'Base language of the clinical battery',
    hintGl: 'Proxecto Nós · Celtia voice · ACOPROS endorsement',
    hintEu: 'HiTZ · AhoTTS · Maider voice · Ulertuz endorsement',
    hintCa: 'Piper voice · UPC ona',
    hintEs419: 'Neutral Latin American variety · Piper voice',
    hintEsDO: 'Quisqueya Habla · dedicated word bank and recordings · FONDOCYT',
    hintEn: 'American English · Piper Lessac',
  },

  credits: {
    navBackA11y: 'Back to the welcome screen',
    navTitle: 'Credits and Endorsements',
    samdBadge: 'Class IIa',
    emblemFootnote:
      'Integrated architecture for audiological, phonetic and swallowing assessment',
    authorBadge: 'AUTHORSHIP AND CLINICAL DIRECTION',
    authorRole: 'Pediatric otolaryngologist and principal investigator',
    partnersTitle: 'PARTNERS AND COLLABORATORS',
    quisqueyaDesc: 'FONDOCYT project · Dominican linguistic adaptation',
    acoprosDesc: 'Association for the Collaboration and Advancement of the Deaf',
    earlifyDesc: 'Health technology and clinical engineering',
    voicesTitle: 'VOICES AND LOCALIZATION',
    qualityTitle: 'QUALITY AND HEALTHCARE REGULATION',
    sealTitle: 'ITEMAS Quality Seal 2024',
    sealSubtitle: 'Technological innovation in healthcare',
    chipSamd: 'SaMD Class IIa',
    chipLocation: 'Lugo, Galicia',
    dockButton: 'Start Professional Selection',

    langEs: 'Base language of the clinical assessment battery',
    langGl: 'Celtia neural voice, word bank endorsed by ACOPROS',
    langEu: 'Maider neural voice, word bank endorsed by Ulertuz',
    langCa: 'Piper neural voice · UPC ona (CC BY-SA 4.0)',
    langEs419: 'Neutral Latin American variety · Piper (CC BY 4.0)',
    langEsDO: 'Dominican variety: dedicated word bank and recordings (FONDOCYT)',
    langEn: 'American English interface and voice · Piper Lessac',
    enginePiper: 'VITS neural voices for Spanish, Catalan, English and their varieties',
    engineEspeak: 'Offline fallback synthesis, no neural weights',
  },

  components: {
    volver: 'Back',
    borrarFirma: 'Clear signature',
    firmeAqui: 'Sign here with your finger or a stylus',
    tamanoLetra: 'Text size',
    lua: 'Lúa ·',
    respiracionGuiada: 'Guided Breathing',
    esp32Ble: 'ESP32 BLE',
    nivel: 'Level',
    filtroPrueba: (a: string | number, b: string | number) =>
      `Filter ${a}, ${b} ${Number(b) === 1 ? 'test' : 'tests'}`,
    duracionEdades: (a: string | number, b: string | number, c: string | number, d: string | number) =>
      `${a}. ${b} Duration ${c}. Ages ${d}.`,
    calibracionOk: 'Calibration OK',
    normal: 'NORMAL',
    leve: 'MILD',
    moderada: 'MODERATE',
    severa: 'SEVERE',
    frecuenciaHz: 'Frequency (Hz)',
    genial: 'AWESOME! ⭐',
  },
};
