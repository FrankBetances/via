/* -------------------------------------------------------------------------- */
/*  VIA+ · Catàleg de cadenes d'INTERFÍCIE · Català                             */
/*                                                                             */
/*  Tipat contra el catàleg base en castellà (`strings.es.ts`): qualsevol clau  */
/*  afegida allà i que manqui aquí trenca `npx tsc --noEmit`. És deliberat —    */
/*  una cadena absent ha de trencar la compilació, mai aparèixer en blanc a la  */
/*  tauleta d'una logopeda.                                                     */
/*                                                                             */
/*  Registre normatiu IEC i TERMCAT (mateix criteri que Valeria+):              */
/*   · «infant» / «criatura», mai «menor» en context clínic general.           */
/*   · «audiòfon», «implant coclear», «hipoacúsia», «sordesa».                  */
/*   · «ajustos» per a les preferències; «desar» per a guardar dades.          */
/*   · Ela geminada correcta (l·l) i apostrofació normativa.                    */
/*                                                                             */
/*  Les cadenes LOCUTADES no viuen aquí (vegeu la capçalera de strings.es.ts).  */
/* -------------------------------------------------------------------------- */
import { UiStrings } from './strings.es';

export const CA: UiStrings = {
  common: {
    continue: 'Continuar',
    back: 'Enrere',
    cancel: 'Cancel·lar',
    save: 'Desar',
    close: 'Tancar',
    accept: "D'acord",
    loading: 'Carregant…',
    retry: 'Torna-ho a provar',
    next: 'Següent',
    finish: 'Finalitzar',
    yes: 'Sí',
    no: 'No',
    notAvailable: 'No disponible',
  },

  langPicker: {
    title: "Idioma de l'aplicació",
    subtitle: "L'elecció canvia els textos i les locucions de tota l'app",
    navA11y: (label: string) => `Idioma actual: ${label}. Toca per canviar d'idioma.`,
    openA11y: "Canviar l'idioma de l'aplicació",
    change: (code: string) => `Canviar idioma (${code})`,
    closeA11y: "Tancar el selector d'idioma",
    optionA11y: (name: string, hint: string) => `${name}: ${hint}`,
    hintEs: 'Idioma base de la bateria clínica',
    hintGl: 'Proxecto Nós · veu Celtia · aval ACOPROS',
    hintEu: 'HiTZ · AhoTTS · veu Maider · aval Ulertuz',
    hintCa: 'Veu Piper · UPC ona',
    hintEs419: 'Variant neutra llatinoamericana · veu Piper',
    hintEsDO: 'Quisqueya Habla · banc i locucions propis · FONDOCYT',
    hintEn: 'Anglès americà · Piper Lessac',
  },

  credits: {
    navBackA11y: 'Tornar a la pantalla de benvinguda',
    navTitle: 'Crèdits i Avals',
    samdBadge: 'Classe IIa',
    emblemFootnote:
      'Arquitectura integrada de valoració audiològica, fonètica i deglutòria',
    authorBadge: 'AUTORIA I DIRECCIÓ CLÍNICA',
    authorRole: 'Otorrinolaringòleg i investigador principal',
    partnersTitle: 'ALIANCES I COL·LABORADORS',
    quisqueyaDesc: 'Projecte FONDOCYT · adaptació lingüística dominicana',
    acoprosDesc: 'Associació de Col·laboració i Promoció del Sord',
    earlifyDesc: 'Tecnologia i enginyeria clínica sanitària',
    voicesTitle: 'VEUS I LOCALITZACIÓ',
    qualityTitle: 'QUALITAT I REGULACIÓ SANITÀRIA',
    sealTitle: 'Segell de Qualitat ITEMAS 2024',
    sealSubtitle: 'Innovació tecnològica en salut',
    chipSamd: 'SaMD Classe IIa',
    chipLocation: 'Lugo, Galícia',
    dockButton: 'Començar Selecció Professional',

    langEs: "Idioma base de la bateria d'avaluació clínica",
    langGl: 'Veu neuronal Celtia, banc aprovat per ACOPROS',
    langEu: 'Veu neuronal Maider, banc aprovat per Ulertuz',
    langCa: 'Veu neuronal Piper · UPC ona (CC BY-SA 4.0)',
    langEs419: 'Variant neutra llatinoamericana · Piper (CC BY 4.0)',
    langEsDO: 'Variant dominicana: banc i locucions propis (FONDOCYT)',
    langEn: 'Interfície i veu en anglès americà · Piper Lessac',
    enginePiper: 'Veus neuronals VITS per a castellà, català, anglès i variants',
    engineEspeak: 'Síntesi de reserva fora de línia, sense pesos neuronals',
  },

  components: {
    volver: 'Tornar',
    borrarFirma: 'Esborrar la signatura',
    firmeAqui: 'Signeu aquí amb el dit o amb un llapis tàctil',
    tamanoLetra: 'Mida de la lletra',
    lua: 'Lúa ·',
    respiracionGuiada: 'Respiració Guiada',
    esp32Ble: 'ESP32 BLE',
    nivel: 'Nivell',
    filtroPrueba: (a: string | number, b: string | number) =>
      `Filtre ${a}, ${b} ${Number(b) === 1 ? 'prova' : 'proves'}`,
    duracionEdades: (a: string | number, b: string | number, c: string | number, d: string | number) =>
      `${a}. ${b} Durada ${c}. Edats ${d}.`,
    calibracionOk: 'Calibratge OK',
    normal: 'NORMAL',
    leve: 'LLEU',
    moderada: 'MODERADA',
    severa: 'GREU',
    frecuenciaHz: 'Freqüència (Hz)',
    genial: 'GENIAL! ⭐',
  },
};
