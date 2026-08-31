/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo de cadeas de INTERFACE · Galego                             */
/*                                                                             */
/*  Tipado contra o catálogo base en castelán (`strings.es.ts`): calquera clave */
/*  engadida alí e ausente aquí rompe `npx tsc --noEmit`. É deliberado — unha   */
/*  cadea que falta ten que romper a compilación, nunca aparecer en branco na   */
/*  tableta dunha logopeda.                                                     */
/*                                                                             */
/*  Rexistro normativo: Real Academia Galega e Dicionario de Galego de          */
/*  Termos Médicos. As cadeas LOCUTADAS non viven aquí (ver a cabeceira de      */
/*  `strings.es.ts`).                                                           */
/* -------------------------------------------------------------------------- */
import { UiStrings } from './strings.es';

export const GL: UiStrings = {
  common: {
    continue: 'Continuar',
    back: 'Atrás',
    cancel: 'Cancelar',
    save: 'Gardar',
    close: 'Pechar',
    accept: 'Aceptar',
    loading: 'Cargando…',
    retry: 'Tentar de novo',
    next: 'Seguinte',
    finish: 'Rematar',
    yes: 'Si',
    no: 'Non',
    notAvailable: 'Non dispoñible',
  },

  langPicker: {
    title: 'Idioma da aplicación',
    subtitle: 'A escolla cambia os textos e as locucións de toda a app',
    navA11y: (label: string) => `Idioma actual: ${label}. Toca para cambiar de idioma.`,
    openA11y: 'Cambiar o idioma da aplicación',
    change: (code: string) => `Cambiar idioma (${code})`,
    closeA11y: 'Pechar o selector de idioma',
    optionA11y: (name: string, hint: string) => `${name}: ${hint}`,
    hintEs: 'Idioma base da batería clínica',
    hintGl: 'Proxecto Nós · voz Celtia · aval ACOPROS',
    hintEu: 'HiTZ · AhoTTS · voz Maider · aval Ulertuz',
    hintCa: 'Voz Piper · UPC ona',
    hintEs419: 'Variante neutra latinoamericana · voz Piper',
    hintEsDO: 'Quisqueya Habla · banco e locucións propios · FONDOCYT',
    hintEn: 'Inglés americano · Piper Lessac',
  },

  credits: {
    navBackA11y: 'Volver á pantalla de benvida',
    navTitle: 'Créditos e Avais',
    samdBadge: 'Clase IIa',
    emblemFootnote:
      'Arquitectura integrada de valoración audiolóxica, fonética e deglutoria',
    authorBadge: 'AUTORÍA E DIRECCIÓN CLÍNICA',
    authorRole: 'Otorrinolaringólogo e investigador principal',
    partnersTitle: 'ALIANZAS E COLABORADORES',
    quisqueyaDesc: 'Proxecto FONDOCYT · adaptación lingüística dominicana',
    acoprosDesc: 'Asociación de Colaboración e Promoción do Xordo',
    earlifyDesc: 'Tecnoloxía e enxeñaría clínica sanitaria',
    voicesTitle: 'VOCES E LOCALIZACIÓN',
    qualityTitle: 'CALIDADE E REGULACIÓN SANITARIA',
    sealTitle: 'Selo de Calidade ITEMAS 2024',
    sealSubtitle: 'Innovación tecnolóxica en saúde',
    chipSamd: 'SaMD Clase IIa',
    chipLocation: 'Lugo, Galicia',
    dockButton: 'Comezar Selección Profesional',

    langEs: 'Idioma base da batería de avaliación clínica',
    langGl: 'Voz neuronal Celtia, banco aprobado por ACOPROS',
    langEu: 'Voz neuronal Maider, banco aprobado por Ulertuz',
    langCa: 'Voz neuronal Piper · UPC ona (CC BY-SA 4.0)',
    langEs419: 'Variante neutra latinoamericana · Piper (CC BY 4.0)',
    langEsDO: 'Variante dominicana: banco e locucións propios (FONDOCYT)',
    langEn: 'Interface e voz en inglés americano · Piper Lessac',
    enginePiper: 'Voces neuronais VITS para castelán, catalán, inglés e variantes',
    engineEspeak: 'Síntese de apoio sen conexión, sen pesos neuronais',
  },

  components: {
    volver: 'Volver',
    borrarFirma: 'Borrar a sinatura',
    firmeAqui: 'Asine aquí co dedo ou cun lapis táctil',
    tamanoLetra: 'Tamaño da letra',
    lua: 'Lúa ·',
    respiracionGuiada: 'Respiración Guiada',
    esp32Ble: 'ESP32 BLE',
    nivel: 'Nivel',
    filtroPrueba: (a: string | number, b: string | number) =>
      `Filtro ${a}, ${b} ${Number(b) === 1 ? 'proba' : 'probas'}`,
    duracionEdades: (a: string | number, b: string | number, c: string | number, d: string | number) =>
      `${a}. ${b} Duración ${c}. Idades ${d}.`,
    calibracionOk: 'Calibración OK',
    normal: 'NORMAL',
    leve: 'LEVE',
    moderada: 'MODERADA',
    severa: 'SEVERA',
    frecuenciaHz: 'Frecuencia (Hz)',
    genial: 'XENIAL! ⭐',
  },
  seleccionProfesional: {
    col: 'Col.',
    quienVaEvaluarHoy: 'Quen vai avaliar hoxe?',
    eligeTuPerfilAccedeTu: 'Escolle o teu perfil e accede coa túa contrasinal',
    registrarNuevoProfesional: 'Rexistrar novo profesional',
    creaTuPerfilSolaVez: 'Crea o teu perfil unha soa vez neste dispositivo',
    n1PerfilRegistrado: '1 PERFIL REXISTRADO',
    perfilesRegistrados: (a: string | number) => `${a} PERFÍS REXISTRADOS`,
    cargandoPerfiles: 'Cargando perfís…',
    aunHayProfesionalesEsteDispositivo: 'Aínda non hai profesionais neste dispositivo. Rexistra o teu perfil para comezar.',
    contrasena: 'Contrasinal',
    cancelar: 'Cancelar',
    acceder: 'Acceder →',
  },

  seleccionEjercicios: {
    volverCap: 'Volver ao CAP',
    sonometroSala: 'Sonómetro da sala',
    comprobarAudio: 'Comprobar o audio',
    reintentando: 'Tentando de novo…',
    reintentarVozSistema: 'Tentar de novo coa voz do sistema',
    comprobarTodaCadena: 'Comprobar toda a cadea',
    verResultadosPreliminares: 'Ver resultados preliminares',
    historialPaciente: 'Historial do paciente',
    cerrarSesion: 'Pechar sesión',
    ningunaPruebaCola: 'Ningunha proba na cola',
    pruebaCola: (a: string | number) => `${a} ${Number(a) === 1 ? 'proba' : 'probas'} na cola`,
    tiempoTotal: '⏱️ Tempo total: ~',
    min: 'min',
    limpiar: 'Limpar',
  },

  bienvenida: {
    procesamientoDsp: 'PROCESAMENTO DSP',
    n48Khz24Bit: '48 kHz · 24-bit',
    ruido: 'RUÍDO',
    informacionClinica: 'INFORMACIÓN CLÍNICA',
    samdClaseIia: 'SaMD Clase IIa',
    valoracionInteractivaAudicionLenguaje: 'VALORACIÓN INTERACTIVA DE AUDICIÓN E LINGUAXE',
    ruido2: 'Do ruído á',
    informacionClinica2: 'información clínica',
    plataformaAvanzadaEvaluacionAudiologicaLenguaje: 'Plataforma avanzada de avaliación audiolóxica e da linguaxe. Procesa obxectivamente a acústica vocal e o comportamento auditivo para unha toma de decisións clínicas con máxima precisión.',
    modulosBateria: (a: string | number) => `${a} Módulos de Batería Clínica`,
    audiometriaTonalCpaVerbalVoz: 'Audiometría (tonal, CPA e verbal), voz acústica, prosodia, articulación, disfaxia, SAHS e FE.',
    n100OnDeviceZeroPhi: '100% On-Device · Zero-PHI',
    dspAcusticoLocalSinSubida: 'DSP acústico local sen subida de audio á nube. Privacidade total e cumprimento normativo estrito.',
    selloCalidadItemas2024: 'Selo de Calidade ITEMAS 2024',
    innovacionSanitariaAvaladaInstitutoSalud: 'Innovación sanitaria avalada polo Instituto de Saúde Carlos III e validación multicéntrica.',
    comenzarExploracionClinica: 'Comezar a Exploración Clínica',
    navegaPantallaCreditosEInicio: 'Navega á pantalla de créditos e inicio de sesión',
    comenzarExploracion: 'Comezar a Exploración',
    viaMedicalSystemMdr2017: 'VIA+ Medical System · MDR 2017/745 · IEC 62304 / ISO 14971',
  },
};
