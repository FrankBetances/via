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
  seleccionProfesional: {
    col: 'Col.',
    quienVaEvaluarHoy: 'Qui farà l’avaluació avui?',
    eligeTuPerfilAccedeTu: 'Tria el teu perfil i accedeix amb la teva contrasenya',
    registrarNuevoProfesional: 'Registrar un nou professional',
    creaTuPerfilSolaVez: 'Crea el teu perfil una sola vegada en aquest dispositiu',
    n1PerfilRegistrado: '1 PERFIL REGISTRAT',
    perfilesRegistrados: (a: string | number) => `${a} PERFILS REGISTRATS`,
    cargandoPerfiles: 'Carregant perfils…',
    aunHayProfesionalesEsteDispositivo: 'Encara no hi ha professionals en aquest dispositiu. Registra el teu perfil per començar.',
    contrasena: 'Contrasenya',
    cancelar: 'Cancel·lar',
    acceder: 'Accedir →',
  },

  seleccionEjercicios: {
    volverCap: 'Tornar al CAP',
    sonometroSala: 'Sonòmetre de la sala',
    comprobarAudio: 'Comprovar l’àudio',
    reintentando: 'Tornant-ho a provar…',
    reintentarVozSistema: 'Tornar a provar amb la veu del sistema',
    comprobarTodaCadena: 'Comprovar tota la cadena',
    verResultadosPreliminares: 'Veure resultats preliminars',
    historialPaciente: 'Historial del pacient',
    cerrarSesion: 'Tancar la sessió',
    ningunaPruebaCola: 'Cap prova a la cua',
    pruebaCola: (a: string | number) => `${a} ${Number(a) === 1 ? 'prova' : 'proves'} a la cua`,
    tiempoTotal: '⏱️ Temps total: ~',
    min: 'min',
    limpiar: 'Netejar',
  },

  bienvenida: {
    procesamientoDsp: 'PROCESSAMENT DSP',
    n48Khz24Bit: '48 kHz · 24 bits',
    ruido: 'SOROLL',
    informacionClinica: 'INFORMACIÓ CLÍNICA',
    samdClaseIia: 'SaMD Classe IIa',
    valoracionInteractivaAudicionLenguaje: 'VALORACIÓ INTERACTIVA DE L’AUDICIÓ I EL LLENGUATGE',
    ruido2: 'Del soroll a la',
    informacionClinica2: 'informació clínica',
    plataformaAvanzadaEvaluacionAudiologicaLenguaje: 'Plataforma avançada d’avaluació audiològica i del llenguatge. Processa objectivament l’acústica vocal i el comportament auditiu per a una presa de decisions clíniques amb la màxima precisió.',
    modulosBateria: (a: string | number) => `${a} mòduls de bateria clínica`,
    audiometriaTonalCpaVerbalVoz: 'Audiometria (tonal, CPA i verbal), veu acústica, prosòdia, articulació, disfàgia, SAHS i funcions executives.',
    n100OnDeviceZeroPhi: '100% al dispositiu · Zero-PHI',
    dspAcusticoLocalSinSubida: 'DSP acústic local sense pujar àudio al núvol. Privacitat total i compliment normatiu estricte.',
    selloCalidadItemas2024: 'Segell de Qualitat ITEMAS 2024',
    innovacionSanitariaAvaladaInstitutoSalud: 'Innovació sanitària avalada per l’Institut de Salut Carles III i validació multicèntrica.',
    comenzarExploracionClinica: 'Començar l’Exploració Clínica',
    navegaPantallaCreditosEInicio: 'Navega a la pantalla de crèdits i inici de sessió',
    comenzarExploracion: 'Començar l’Exploració',
    viaMedicalSystemMdr2017: 'VIA+ Medical System · MDR 2017/745 · IEC 62304 / ISO 14971',
  },
};
