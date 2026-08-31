/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo de cadenas de INTERFAZ · Español latinoamericano (es-419)   */
/*                                                                             */
/*  Es un DELTA sobre el castellano peninsular, no un catálogo aparte, porque   */
/*  es LA MISMA LENGUA: escribirlo entero duplicaría ~700 cadenas idénticas y   */
/*  garantizaría que las dos copias se separen con el tiempo. Se parte de `ES`  */
/*  y solo se sobrescribe lo que de verdad cambia de variedad.                  */
/*                                                                             */
/*  El tipo sigue siendo `UiStrings`, así que la cobertura está igual de        */
/*  garantizada por el compilador: el spread aporta todas las claves y una      */
/*  clave nueva en `strings.es.ts` llega aquí sola, en castellano peninsular,   */
/*  hasta que alguien decida que necesita variante.                             */
/*                                                                             */
/*  Criterio de qué se cambia: léxico que un profesional latinoamericano no     */
/*  usa («ordenador», «móvil», «vale») y el tratamiento. Lo que se dice igual   */
/*  a los dos lados del Atlántico NO se toca: inventar diferencias donde no las */
/*  hay es tan malo como no marcar las que existen.                             */
/* -------------------------------------------------------------------------- */
import { ES, UiStrings } from './strings.es';

export const ES_419: UiStrings = {
  ...ES,

  common: {
    ...ES.common,
    back: 'Regresar',
    accept: 'Aceptar',
    retry: 'Volver a intentar',
  },

  langPicker: {
    ...ES.langPicker,
    subtitle: 'La selección cambia los textos y las locuciones de toda la app',
    navA11y: (label: string) => `Idioma actual: ${label}. Toca para cambiar de idioma.`,
  },

  credits: {
    ...ES.credits,
    authorRole: 'Otorrinolaringólogo e investigador principal',
    earlifyDesc: 'Tecnología e ingeniería clínica en salud',
    qualityTitle: 'CALIDAD Y REGULACIÓN SANITARIA',
  },

  components: {
    ...ES.components,
    volver: 'Regresar',
    tamanoLetra: 'Tamaño de letra',
    firmeAqui: 'Firme aquí con el dedo o con un lápiz táctil',
  },
  seleccionProfesional: {
    ...ES.seleccionProfesional,
    eligeTuPerfilAccedeTu: 'Elige tu perfil e ingresa con tu contraseña',
    creaTuPerfilSolaVez: 'Crea tu perfil una sola vez en este dispositivo',
    aunHayProfesionalesEsteDispositivo: 'Todavía no hay profesionales en este dispositivo. Registra tu perfil para comenzar.',
    acceder: 'Ingresar →',
  },

  seleccionEjercicios: {
    ...ES.seleccionEjercicios,
    volverCap: 'Volver al centro de atención',
    sonometroSala: 'Sonómetro de la sala',
    cerrarSesion: 'Cerrar la sesión',
  },

  bienvenida: {
    ...ES.bienvenida,
    n100OnDeviceZeroPhi: '100% en el dispositivo · Zero-PHI',
    dspAcusticoLocalSinSubida: 'DSP acústico local sin subir audio a la nube. Privacidad total y cumplimiento normativo estricto.',
  },
  registroProfesional: {
    ...ES.registroProfesional,
    nombreCentro: 'nombre@centro.com',
    nColegiadoOpcional: 'N.º de registro profesional · opcional',
    esteRegistroRealizaSolaVez: 'Este registro se realiza una sola vez y crea tu cuenta segura. Después bastará con tocar tu perfil e ingresar tu contraseña en la pantalla de acceso.',
  },

  registroPaciente: {
    ...ES.registroPaciente,
    numeroHistoriaClinicaNhc: 'Número de historia clínica (NHC)',
    lenguaMaterna: 'Lengua materna',
  },

  pacientes: {
    ...ES.pacientes,
    cerrarSesion: 'Cerrar la sesión',
    buscarNombreNhc: 'Buscar por nombre o NHC…',
  },

  historialPaciente: {
    ...ES.historialPaciente,
    estePacienteTodaviaTieneNinguna: 'Este paciente todavía no tiene ninguna evaluación. Ábralo desde la lista de pacientes para iniciar una.',
  },

  consentimiento: {
    ...ES.consentimiento,
    pacienteMenorEdadFirmaPadre: 'Paciente menor de edad: firma su padre, madre o tutor legal',
    conyugeHijoTutor: 'Cónyuge, hijo/a, tutor/a…',
  },
  roomNoise: {
    ...ES.roomNoise,
    saltarSonometroEIrPruebas: 'Omitir el sonómetro e ir a las pruebas',
    mantengaSalaSilencioDuranteMedicion: 'Mantenga la sala en silencio durante la medición',
  },

  diagnosticoAudio: {
    ...ES.diagnosticoAudio,
    volver: 'Regresar',
    recorreCadenaCompletaMotorNativo: 'Recorre la cadena completa —motor nativo, bocina, banco de locuciones, sintetizador del sistema y micrófono— y dice exactamente qué eslabón falla. Ejecútela en el mismo equipo y la misma sala donde las pruebas no funcionan.',
    motorProgrameSonidoPruebaAltavoz: 'Que el motor programe un sonido no prueba que la bocina lo emita, y la app suena por TRES vías distintas: si una falla, las otras siguen respondiendo. Reproduzca las cuatro emisiones y conteste cuáles ha oído — hasta entonces, la salida NO está comprobada.',
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
    ninoJuegaSoloApoyoMinimo: '. El niño juega solo (o con apoyo mínimo en los más pequeños): cada juego explica su consigna con una pantalla amable y avanza automáticamente. Duración total ≈ 8–12 min.',
    edadGraduaDificultadNTarjetas: 'La edad gradúa la dificultad: número de tarjetas, velocidad, longitud de secuencias y cambio de reglas.',
    peroMiniJuegosAunTienen: ', pero los mini-juegos aún no tienen consigna revisada en esa lengua: se dictarán en castellano y con voz castellana. Traducirlos sin revisión de un fonoaudiólogo sería inventar el estímulo.',
    colegiado: 'Registro profesional',
    cribadoOrientativoJuegoSustituyeInstrumentos: 'Cribado orientativo por juego. No sustituye instrumentos estandarizados ni constituye diagnóstico.',
  },

  efGames: {
    ...ES.efGames,
    normaHaCambiado: '¡La regla cambió! 🔄',
  },

  prosody: {
    ...ES.prosody,
    valoresDescriptivosSinBaremoPoblacional: 'Valores descriptivos, sin baremo poblacional: no se emite juicio de normalidad. La comparación válida es con tomas anteriores del mismo niño en la misma tarea. Las medidas acústicas no sustituyen la valoración perceptiva del fonoaudiólogo.',
    nColegiado: 'N.º de registro profesional',
  },
  articulation: {
    ...ES.articulation,
    registroDescriptivoProduccionRepeticionSustituye: 'Registro descriptivo de la producción a la repetición. No sustituye el juicio clínico del fonoaudiólogo.',
    grabar: 'Grabar',
    colegiado: 'Registro profesional',
    inventarioFoneticoEspanolTR: 'El inventario fonético es del español (T.A.R.), así que la variante dominicana cambia el acento de la voz pero no las palabras.',
  },

  verbalAudiometry: {
    ...ES.verbalAudiometry,
    suenaPalabraAltavozTocaTarjeta: ': suena una palabra por la bocina y toca la tarjeta correspondiente. La palabra suena sola en cada lámina y la pantalla avanza sola tras cada respuesta.',
    tocaAltavozOirlaOtraVez: 'Toca la bocina para oírla otra vez (',
    nivelOrientativoPresentacionAltavozEsta: '⚠️ Nivel orientativo: la presentación por bocina no está calibrada clínicamente. La salida robusta es el % de discriminación a voz conversacional. Resultado binaural (mejor oído): no descarta pérdida unilateral.',
    colegiado: 'Registro profesional',
  },
  voiceAnalysis: {
    ...ES.voiceAnalysis,
    grabando: 'GRABANDO',
    medidasTomadasMicrofonoDispositivoSin: 'Medidas tomadas con el micrófono del dispositivo, sin calibración acústica certificada y sin baremo poblacional infantil: son descriptivas y no constituyen por sí solas un juicio de normalidad. La comparación válida es con tomas anteriores del mismo niño en las mismas condiciones. No sustituyen la valoración perceptiva del fonoaudiólogo.',
    colegiado: 'Registro profesional',
  },

  audiometry: {
    ...ES.audiometry,
    colegiado: 'Registro profesional',
  },

  audiometryConditioned: {
    ...ES.audiometryConditioned,
    aconsejaDerivacionOrlAudiologiaAudiometria: '. Se aconseja derivación a otorrinolaringología / audiología para audiometría clínica con audífonos.',
    colegiado: 'Registro profesional',
  },
};
