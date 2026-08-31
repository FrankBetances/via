/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo de cadenas de INTERFAZ · Español dominicano (es-DO)         */
/*  Quisqueya Habla · FONDOCYT                                                  */
/*                                                                             */
/*  DELTA sobre el castellano peninsular, por el mismo motivo que `es-419`      */
/*  (ver su cabecera): es la misma lengua, y duplicar ~700 cadenas idénticas    */
/*  solo garantiza que las copias se separen.                                   */
/*                                                                             */
/*  OJO con el alcance. Lo que Quisqueya Habla adapta con criterio clínico es   */
/*  el BANCO DE ESTÍMULOS y las LOCUCIONES —eso vive en                         */
/*  `verbalAudiometryLists.es-DO` y en el corpus de voz, no aquí—. La interfaz  */
/*  que lee el profesional es la misma prosa clínica, con el léxico de trato    */
/*  local. Meter aquí variantes del habla infantil dominicana sería confundir   */
/*  los dos ejes.                                                               */
/* -------------------------------------------------------------------------- */
import { ES, UiStrings } from './strings.es';

export const ES_DO: UiStrings = {
  ...ES,

  common: {
    ...ES.common,
    back: 'Regresar',
    retry: 'Volver a intentar',
  },

  langPicker: {
    ...ES.langPicker,
    subtitle: 'La selección cambia los textos y las locuciones de toda la app',
  },

  credits: {
    ...ES.credits,
    earlifyDesc: 'Tecnología e ingeniería clínica en salud',
    /* La variedad dominicana es la propia: en su catálogo se nombra sin el
     * paréntesis explicativo que necesita el resto. */
    langEsDO: 'Variedad dominicana: banco y locuciones propios (FONDOCYT)',
  },

  components: {
    ...ES.components,
    volver: 'Regresar',
    firmeAqui: 'Firme aquí con el dedo o con un lápiz táctil',
  },
  seleccionProfesional: {
    ...ES.seleccionProfesional,
    eligeTuPerfilAccedeTu: 'Elige tu perfil e ingresa con tu contraseña',
    aunHayProfesionalesEsteDispositivo: 'Todavía no hay profesionales en este dispositivo. Registra tu perfil para comenzar.',
    acceder: 'Ingresar →',
  },

  seleccionEjercicios: {
    ...ES.seleccionEjercicios,
    sonometroSala: 'Sonómetro de la sala',
  },

  bienvenida: {
    ...ES.bienvenida,
    n100OnDeviceZeroPhi: '100% en el dispositivo · Zero-PHI',
  },
  registroProfesional: {
    ...ES.registroProfesional,
    nombreCentro: 'nombre@centro.do',
    nColegiadoOpcional: 'N.º de exequátur · opcional',
    esteRegistroRealizaSolaVez: 'Este registro se realiza una sola vez y crea tu cuenta segura. Después bastará con tocar tu perfil e ingresar tu contraseña en la pantalla de acceso.',
  },

  registroPaciente: {
    ...ES.registroPaciente,
    lenguaMaterna: 'Lengua materna',
  },

  pacientes: {
    ...ES.pacientes,
    cerrarSesion: 'Cerrar la sesión',
  },

  historialPaciente: {
    ...ES.historialPaciente,
    estePacienteTodaviaTieneNinguna: 'Este paciente todavía no tiene ninguna evaluación. Ábralo desde la lista de pacientes para iniciar una.',
  },

  consentimiento: {
    ...ES.consentimiento,
    pacienteMenorEdadFirmaPadre: 'Paciente menor de edad: firma su padre, madre o tutor legal',
  },
  roomNoise: {
    ...ES.roomNoise,
    saltarSonometroEIrPruebas: 'Omitir el sonómetro e ir a las pruebas',
  },

  diagnosticoAudio: {
    ...ES.diagnosticoAudio,
    volver: 'Regresar',
  },

  resultadosPreliminares: {
    ...ES.resultadosPreliminares,
    volverPruebas: 'Regresar a pruebas',
  },

  resultadosFinal: {
    ...ES.resultadosFinal,
    volverResultadosPreliminares: 'Regresar a resultados preliminares',
    pendienteFirmaFacultativoResponsable: 'Pendiente de firma del médico responsable',
  },

  startup: {
    ...ES.startup,
  },
  executiveFunctions: {
    ...ES.executiveFunctions,
    peroMiniJuegosAunTienen: ', pero los mini-juegos aún no tienen consigna revisada en esa lengua: se dictarán en castellano y con voz castellana. Traducirlos sin revisión de un terapeuta del habla sería inventar el estímulo.',
    colegiado: 'Exequátur',
    cribadoOrientativoJuegoSustituyeInstrumentos: 'Cribado orientativo por juego. No sustituye instrumentos estandarizados ni constituye diagnóstico.',
  },

  efGames: {
    ...ES.efGames,
    normaHaCambiado: '¡La regla cambió! 🔄',
  },

  prosody: {
    ...ES.prosody,
    valoresDescriptivosSinBaremoPoblacional: 'Valores descriptivos, sin baremo poblacional: no se emite juicio de normalidad. La comparación válida es con tomas anteriores del mismo niño en la misma tarea. Las medidas acústicas no sustituyen la valoración perceptiva del terapeuta del habla.',
    nColegiado: 'N.º de exequátur',
  },
  articulation: {
    ...ES.articulation,
    registroDescriptivoProduccionRepeticionSustituye: 'Registro descriptivo de la producción a la repetición. No sustituye el juicio clínico del terapeuta del habla.',
    colegiado: 'Exequátur',
  },

  verbalAudiometry: {
    ...ES.verbalAudiometry,
    suenaPalabraAltavozTocaTarjeta: ': suena una palabra por la bocina y toca la tarjeta correspondiente. La palabra suena sola en cada lámina y la pantalla avanza sola tras cada respuesta.',
    tocaAltavozOirlaOtraVez: 'Toca la bocina para oírla otra vez (',
    colegiado: 'Exequátur',
  },
  voiceAnalysis: {
    ...ES.voiceAnalysis,
    medidasTomadasMicrofonoDispositivoSin: 'Medidas tomadas con el micrófono del dispositivo, sin calibración acústica certificada y sin baremo poblacional infantil: son descriptivas y no constituyen por sí solas un juicio de normalidad. La comparación válida es con tomas anteriores del mismo niño en las mismas condiciones. No sustituyen la valoración perceptiva del terapeuta del habla.',
    colegiado: 'Exequátur',
  },

  audiometry: {
    ...ES.audiometry,
    colegiado: 'Exequátur',
  },

  audiometryConditioned: {
    ...ES.audiometryConditioned,
    aconsejaDerivacionOrlAudiologiaAudiometria: '. Se aconseja derivación a otorrinolaringología / audiología para audiometría clínica con audífonos.',
    colegiado: 'Exequátur',
  },
};
