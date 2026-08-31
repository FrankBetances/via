/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo de cadenas de INTERFAZ · castellano                         */
/*                                                                             */
/*  PORTE de `src/i18n/strings.es.ts` de Valeria+ (regla 1). Este fichero es la */
/*  FUENTE DE VERDAD del catálogo: su forma define el tipo `UiStrings`, y los   */
/*  seis catálogos restantes se declaran CON ese tipo. Consecuencia buscada: si */
/*  aquí se añade una clave y allí no, `npx tsc --noEmit` falla. Una cadena que */
/*  falta tiene que romper el build, no aparecer en blanco en la tablet de una  */
/*  logopeda.                                                                   */
/*                                                                             */
/*  Convenciones (las de Valeria+, sin cambios):                               */
/*   · Un namespace por pantalla, más `common` para lo compartido.             */
/*   · Texto con datos dentro → FUNCIÓN tipada, nunca concatenación en la      */
/*     pantalla: el orden de las palabras cambia entre idiomas.                */
/*   · Las cadenas LOCUTADAS no viven aquí. Van en la capa de voz              */
/*     (`src/Voice/viaVoiceConsignas.ts` y los bancos por variedad) porque el  */
/*     corpus las enumera para pregenerar su audio; mezclarlas rompería esa    */
/*     tubería y el gate `export-voice-corpus.js` dejaría de cuadrar.          */
/*   · El acceso es por PROPIEDAD (`t.credits.navTitle`), no por clave de       */
/*     texto: una clave mal escrita la caza el compilador, no el QA.           */
/* -------------------------------------------------------------------------- */

export const ES = {
  common: {
    continue: 'Continuar',
    back: 'Atrás',
    cancel: 'Cancelar',
    save: 'Guardar',
    close: 'Cerrar',
    accept: 'Aceptar',
    loading: 'Cargando…',
    retry: 'Reintentar',
    next: 'Siguiente',
    finish: 'Finalizar',
    yes: 'Sí',
    no: 'No',
    notAvailable: 'No disponible',
  },

  /* Selector de idioma de la interfaz (cabecera de Créditos y tarjeta de
   * voces). Vive aquí y no en el componente para que el propio selector se
   * lea en el idioma activo. */
  langPicker: {
    title: 'Idioma de la aplicación',
    subtitle: 'La elección cambia los textos y las locuciones de toda la app',
    navA11y: (label: string) => `Idioma actual: ${label}. Toca para cambiar de idioma.`,
    openA11y: 'Cambiar el idioma de la aplicación',
    change: (code: string) => `Cambiar idioma (${code})`,
    closeA11y: 'Cerrar el selector de idioma',
    optionA11y: (name: string, hint: string) => `${name}: ${hint}`,
    /* Pie de cada opción: qué aporta esa variedad, no su estado de revisión. */
    hintEs: 'Idioma base de la batería clínica',
    hintGl: 'Proxecto Nós · voz Celtia · aval ACOPROS',
    hintEu: 'HiTZ · AhoTTS · voz Maider · aval Ulertuz',
    hintCa: 'Veu Piper · UPC ona',
    hintEs419: 'Variante neutra latinoamericana · voz Piper',
    hintEsDO: 'Quisqueya Habla · banco y locuciones propios · FONDOCYT',
    hintEn: 'American English · Piper Lessac',
  },

  credits: {
    navBackA11y: 'Volver a la pantalla de bienvenida',
    navTitle: 'Créditos y Avales',
    samdBadge: 'Clase IIa',
    emblemFootnote:
      'Arquitectura integrada de valoración audiológica, fonética y deglutoria',
    authorBadge: 'AUTORÍA Y DIRECCIÓN CLÍNICA',
    authorRole: 'Otorrinolaringólogo e investigador principal',
    partnersTitle: 'ALIANZAS Y COLABORADORES',
    quisqueyaDesc: 'Proyecto FONDOCYT · adaptación lingüística dominicana',
    acoprosDesc: 'Asociación de Colaboración y Promoción del Sordo',
    earlifyDesc: 'Tecnología e ingeniería clínica sanitaria',
    voicesTitle: 'VOCES Y LOCALIZACIÓN',
    qualityTitle: 'CALIDAD Y REGULACIÓN SANITARIA',
    sealTitle: 'Sello de Calidad ITEMAS 2024',
    /* El rediseño proponía «Innovación sanitaria avalada por el ISCIII». Es
     * una afirmación sobre una acreditación, más fuerte que la actual, y
     * cambiarla no es efecto colateral de un cambio de estilo: se mantiene la
     * que ya estaba hasta que Frank confirme los términos del sello. */
    sealSubtitle: 'Innovación tecnológica en salud',
    chipSamd: 'SaMD Clase IIa',
    chipLocation: 'Lugo, Galicia',
    dockButton: 'Comenzar Selección Profesional',

    /* Créditos de voz y localización, uno por variedad. Se listan aquí —y no
     * como datos sueltos en la pantalla— porque son texto que se lee y por
     * tanto se traduce. La ATRIBUCIÓN de los motores es obligatoria: las
     * voces Piper de `ca` y `es-419` son CC BY-SA 4.0 y CC BY 4.0, y las dos
     * exigen citar al autor (ver `tools/nos/voices.json`). */
    langEs: 'Idioma base de la batería de evaluación clínica',
    langGl: 'Voz neuronal Celtia, banco aprobado por ACOPROS',
    langEu: 'Voz neuronal Maider, banco aprobado por Ulertuz',
    langCa: 'Voz neuronal Piper · UPC ona (CC BY-SA 4.0)',
    langEs419: 'Variante neutra latinoamericana · Piper (CC BY 4.0)',
    langEsDO: 'Variante dominicana: banco y locuciones propios (FONDOCYT)',
    langEn: 'Interfaz y voz en inglés americano · Piper Lessac',
    enginePiper: 'Voces neuronales VITS para castellano, catalán, inglés y variantes',
    engineEspeak: 'Síntesis de respaldo offline sin pesos neuronales',
  },

  /* Componentes compartidos entre pantallas: cabecera, firma, control de
   * tamaño de letra, mascota, tarjetas del hub, audiograma y tren. */
  components: {
    volver: 'Volver',
    borrarFirma: 'Borrar firma',
    firmeAqui: 'Firme aquí con el dedo o un lápiz táctil',
    tamanoLetra: 'Tamaño de letra',
    lua: 'Lúa ·',
    respiracionGuiada: 'Respiración Guiada',
    esp32Ble: 'ESP32 BLE',
    nivel: 'Nivel',
    /* El plural lo forma CADA lengua: la pantalla pasa el número, no la «s».
     * Antes llegaba ya resuelto (`count === 1 ? '' : 's'`), que es castellano
     * incrustado en el sitio donde no se puede traducir. */
    filtroPrueba: (a: string | number, b: string | number) =>
      `Filtro ${a}, ${b} ${Number(b) === 1 ? 'prueba' : 'pruebas'}`,
    duracionEdades: (a: string | number, b: string | number, c: string | number, d: string | number) =>
      `${a}. ${b} Duración ${c}. Edades ${d}.`,
    calibracionOk: 'Calibración OK',
    normal: 'NORMAL',
    leve: 'LEVE',
    moderada: 'MODERADA',
    severa: 'SEVERA',
    frecuenciaHz: 'Frecuencia (Hz)',
    genial: '¡GENIAL! ⭐',
  },
  seleccionProfesional: {
    col: 'Col.',
    quienVaEvaluarHoy: '¿Quién va a evaluar hoy?',
    eligeTuPerfilAccedeTu: 'Elige tu perfil y accede con tu contraseña',
    registrarNuevoProfesional: 'Registrar nuevo profesional',
    creaTuPerfilSolaVez: 'Crea tu perfil una sola vez en este dispositivo',
    n1PerfilRegistrado: '1 PERFIL REGISTRADO',
    perfilesRegistrados: (a: string | number) => `${a} PERFILES REGISTRADOS`,
    cargandoPerfiles: 'Cargando perfiles…',
    aunHayProfesionalesEsteDispositivo: 'Aún no hay profesionales en este dispositivo. Registra tu perfil para comenzar.',
    contrasena: 'Contraseña',
    cancelar: 'Cancelar',
    acceder: 'Acceder →',
  },

  seleccionEjercicios: {
    volverCap: 'Volver al CAP',
    sonometroSala: 'Sonómetro de sala',
    comprobarAudio: 'Comprobar audio',
    reintentando: 'Reintentando…',
    reintentarVozSistema: 'Reintentar la voz del sistema',
    comprobarTodaCadena: 'Comprobar toda la cadena',
    verResultadosPreliminares: 'Ver resultados preliminares',
    historialPaciente: 'Historial del paciente',
    cerrarSesion: 'Cerrar sesión',
    ningunaPruebaCola: 'Ninguna prueba en cola',
    pruebaCola: (a: string | number) => `${a} ${Number(a) === 1 ? 'prueba' : 'pruebas'} en cola`,
    tiempoTotal: '⏱️ Tiempo total: ~',
    min: 'min',
    limpiar: 'Limpiar',
  },

  bienvenida: {
    procesamientoDsp: 'PROCESAMIENTO DSP',
    n48Khz24Bit: '48 kHz · 24-bit',
    ruido: 'RUIDO',
    informacionClinica: 'INFORMACIÓN CLÍNICA',
    samdClaseIia: 'SaMD Clase IIa',
    valoracionInteractivaAudicionLenguaje: 'VALORACIÓN INTERACTIVA DE AUDICIÓN Y LENGUAJE',
    ruido2: 'Del ruido a la',
    informacionClinica2: 'información clínica',
    plataformaAvanzadaEvaluacionAudiologicaLenguaje: 'Plataforma avanzada de evaluación audiológica y del lenguaje. Procesa objetivamente la acústica vocal y el comportamiento auditivo para una toma de decisiones clínicas con máxima precisión.',
    /* El número se DEDUCE de la constelación de módulos. Estaba escrito a mano
     * como «12» con trece módulos en la batería: el mismo defecto que ya se
     * corrigió en Créditos, y que traducirlo a siete lenguas habría fijado. */
    modulosBateria: (a: string | number) => `${a} Módulos de Batería Clínica`,
    audiometriaTonalCpaVerbalVoz: 'Audiometría (tonal, CPA y verbal), voz acústica, prosodia, articulación, disfagia, SAHS y FE.',
    n100OnDeviceZeroPhi: '100% On-Device · Zero-PHI',
    dspAcusticoLocalSinSubida: 'DSP acústico local sin subida de audio a la nube. Privacidad total y cumplimiento normativo estricto.',
    selloCalidadItemas2024: 'Sello de Calidad ITEMAS 2024',
    innovacionSanitariaAvaladaInstitutoSalud: 'Innovación sanitaria avalada por el Instituto de Salud Carlos III y validación multicéntrica.',
    comenzarExploracionClinica: 'Comenzar Exploración Clínica',
    navegaPantallaCreditosEInicio: 'Navega a la pantalla de créditos e inicio de sesión',
    comenzarExploracion: 'Comenzar Exploración',
    viaMedicalSystemMdr2017: 'VIA+ Medical System · MDR 2017/745 · IEC 62304 / ISO 14971',
  },
  registroProfesional: {
    perfilProfesionalSolaVez: 'PERFIL PROFESIONAL · UNA SOLA VEZ',
    creaTuPerfil: 'Crea tu perfil',
    responsableEvaluacionesEsteDispositivo: 'Responsable de las evaluaciones de este dispositivo',
    asiVeraTuPerfil: 'ASÍ SE VERÁ TU PERFIL',
    tuNombreApellidos: 'Tu nombre y apellidos',
    eligeTuRol: 'Elige tu rol',
    col: 'Col.',
    nombreApellidos: 'Nombre y apellidos',
    ejElenaRuizSoto: 'Ej. Elena Ruiz Soto',
    rolProfesional: 'Rol profesional',
    email: 'Email',
    nombreCentro: 'nombre@centro.es',
    contrasena: 'Contraseña',
    minimo6Caracteres: 'Mínimo 6 caracteres',
    nColegiadoOpcional: 'Nº colegiado · opcional',
    centroTrabajoOpcional: 'Centro de trabajo · opcional',
    hospitalCentroSalud: 'Hospital / Centro de salud',
    esteRegistroRealizaSolaVez: 'Este registro se realiza una sola vez y crea tu cuenta segura. Después bastará con tocar tu perfil e introducir tu contraseña en la pantalla de acceso.',
    n4Obligatorios: '/4 obligatorios',
    guardarContinuar: 'Guardar y continuar',
  },
  registroPaciente: {
    nuevoPaciente: 'Nuevo paciente',
    registroSociodemograficoEstaSesion: 'Registro sociodemográfico para esta sesión',
    nombreApellidos: 'Nombre y apellidos',
    nombre: 'Nombre',
    apellidos: 'Apellidos',
    fechaNacimiento: 'Fecha de nacimiento',
    aaaaMmDd: 'AAAA-MM-DD',
    edad: 'Edad',
    introduceFechaValidaFormatoAaaa: 'Introduce una fecha válida con formato AAAA-MM-DD (no futura).',
    sexo: 'Sexo',
    numeroHistoriaClinicaNhc: 'Número de historia clínica (NHC)',
    lenguaMaterna: 'Lengua materna',
    espanol: 'Español',
    n4CamposObligatoriosCompletados: '/4 campos obligatorios completados',
    continuarConsentimiento: 'Continuar al consentimiento',
    irDirectoExploracionDisfagia: 'Ir directo a exploración de disfagia',
    disfagiaRequiereCapNiSonometro: 'La disfagia no requiere CAP ni sonómetro de sala (el consentimiento sí)',
  },
  pacientes: {
    completado: 'Completado',
    curso: 'En curso',
    nhc: 'NHC',
    evaluacionRegistrada: 'Evaluación registrada',
    sinEvaluacionesPrevias: 'Sin evaluaciones previas',
    verResultados: (a: string | number) => `Ver resultados de ${a}`,
    verResultadosPruebasRealizadas: 'Ver resultados de pruebas realizadas',
    pacientes: 'Pacientes',
    creaRegistroNuevoAbreExpediente: 'Crea un registro nuevo o abre un expediente previo',
    cerrarSesion: 'Cerrar sesión',
    nuevoPaciente: 'Nuevo paciente',
    registraDatosPacienteEmpiezaSesion: 'Registra los datos de un paciente y empieza una sesión de evaluación',
    registrosPrevios: 'Registros previos',
    expediente: 'expediente',
    buscarNombreNhc: 'Buscar por nombre o NHC…',
    cargandoPacientes: 'Cargando pacientes…',
    sinExpedientesRegistradosTodavia: 'Sin expedientes registrados todavía.',
  },
  historialPaciente: {
    historialPruebas: 'Historial de pruebas',
    nhc: (a: string | number) => ` · NHC ${a}`,
    cargandoHistorial: 'Cargando historial…',
    sinSesionesRegistradas: 'Sin sesiones registradas',
    estePacienteTodaviaTieneNinguna: 'Este paciente todavía no tiene ninguna evaluación. Ábralo desde la lista de pacientes para empezar una.',
    sesion: 'sesión',
    prueba: 'prueba',
    hallazgos: (a: string | number) => ` · ${a} con hallazgos`,
    completada: 'Completada',
    curso: 'En curso',
    estaSesionLlegoRegistrarNinguna: 'Esta sesión no llegó a registrar ninguna prueba.',
    resumenOrientativoPruebasYaRegistradas: 'Resumen orientativo de pruebas ya registradas. No constituye un informe clínico definitivo.',
    volverPacientes: 'Volver a pacientes',
  },
  consentimiento: {
    consentimientoInformado: 'Consentimiento informado',
    obligatorio: 'OBLIGATORIO',
    paciente: (a: string | number) => `Paciente: ${a}`,
    debeFirmarseAntesIniciarPruebas: 'Debe firmarse antes de iniciar las pruebas',
    consentimientoYaFirmado: 'Consentimiento ya firmado',
    firmado: 'Firmado por',
    continuar: 'Continuar',
    informacionEvaluacion: 'Información de la evaluación',
    versionDocumento: 'Versión del documento',
    personaFirma: 'Persona que firma',
    comprobandoEdadPaciente: 'Comprobando la edad del paciente…',
    pacienteMenorEdadFirmaPadre: 'Paciente menor de edad: firma su padre/madre o tutor legal',
    pacienteMayorEdad: 'Paciente mayor de edad',
    pudoDeterminarEdadPaciente: 'No se pudo determinar la edad del paciente',
    firmaRepresentacionAdultoPuedeHacerlo: 'Firma en representación de un adulto que no puede hacerlo por sí mismo (p. ej., trastorno neurodegenerativo o incapacidad para firmar). Indique el motivo: quedará registrado en el consentimiento.',
    nombreApellidosQuienFirma: 'Nombre y apellidos de quien firma',
    nombreCompleto: 'Nombre completo',
    relacionPaciente: 'Relación con el paciente',
    conyugeHijoTutor: 'Cónyuge, hijo/a, tutor/a…',
    motivoPacienteFirma: 'Motivo por el que el paciente no firma',
    pEjEnfermedadAlzheimerFase: 'P. ej., enfermedad de Alzheimer en fase moderada; incapacidad motora para firmar…',
    declaracionFirma: 'Declaración y firma',
    firma: 'Firma',
    firmarContinuarDisfagia: 'Firmar y continuar a disfagia',
    firmarContinuarCap: 'Firmar y continuar al CAP',
    sinConsentimientoFirmadoPosibleIniciar: 'Sin consentimiento firmado no es posible iniciar las pruebas',
  },
  roomNoise: {
    sonometroAmbiental: 'Sonómetro Ambiental',
    prerrequisitoSala: 'PRERREQUISITO · SALA',
    verificacionRuidoAmbienteAntesIniciar: 'Verificación de ruido ambiente antes de iniciar los ejercicios',
    nivelRuidoAmbiente: 'Nivel de ruido ambiente',
    mantengaSalaSilencioDuranteMedicion: 'Mantenga la sala en silencio durante la medición',
    microfonoInactivo: 'MICRÓFONO INACTIVO',
    descartaron: 'Se descartaron',
    tramo: 'tramo',
    saturacionMicrofonoGolpesRocesEquipo: 'por saturación del micrófono (golpes o roces del equipo). Deje el dispositivo apoyado y quieto durante la medición.',
    midiendoRuidoAmbiente: 'Midiendo ruido ambiente…',
    detener: 'Detener',
    activarMicrofono: 'Activar micrófono',
    midiendo: 'Midiendo…',
    repetirMedicion: 'Repetir medición',
    medirS: (a: string | number) => `Medir ${a} s`,
    calibracionCampo: 'CALIBRACIÓN DE CAMPO',
    ajusteLecturaSonometroReferenciaMisma: 'Ajuste la lectura a un sonómetro de referencia en la misma sala. El ajuste se guarda en este dispositivo.',
    microfonoActivoEscribaMarcaSonometro: 'Con el micrófono activo, escriba lo que marca el sonómetro patrón y VIA+ calculará el ajuste.',
    dbPatron: 'dB(A) del patrón',
    ajustar: 'Ajustar',
    pudoMedir: 'No se pudo medir',
    condicionAcustica: 'CONDICIÓN ACÚSTICA',
    condicionesSala: 'Condiciones de la sala',
    pruebasDiscriminacionAuditivaRequieren: 'Las pruebas de discriminación auditiva requieren ≤',
    dbRuidoFondoLecturaPonderacion: 'dB(A) de ruido de fondo. Lectura con ponderación A (IEC 61672) sobre el micrófono del dispositivo, sin calibración certificada: es orientativa y no sustituye a un sonómetro patrón.',
    requisitos: 'Requisitos',
    continuarEjercicios: 'Continuar a los ejercicios',
    saltarSonometroEIrPruebas: 'Saltar el sonómetro e ir a las pruebas',
    sinVerificarSalaPruebasDiscriminacion: 'Sin verificar la sala, las pruebas de discriminación auditiva (audiometrías y verbal) pierden comparabilidad. El resto de la batería no depende del ruido de fondo.',
  },
  diagnosticoAudio: {
    volver: 'Volver',
    diagnosticoDispositivo: 'DIAGNÓSTICO DEL DISPOSITIVO',
    comprobacionAudio: 'Comprobación de audio',
    recorreCadenaCompletaMotorNativo: 'Recorre la cadena completa —motor nativo, altavoz, banco de locuciones, sintetizador del sistema y micrófono— y dice exactamente qué eslabón falla. Ejecútela en el mismo equipo y la misma sala donde las pruebas no funcionan.',
    comprobando: 'Comprobando…',
    repetirComprobacion: 'Repetir comprobación',
    iniciarComprobacion: 'Iniciar comprobación',
    hayMenosEslabonRotoPruebas: 'Hay al menos un eslabón roto: las pruebas de voz no pueden funcionar así.',
    motoresRespondenPeroSalidaEsta: (a: string | number, b: string | number) => `Los motores responden, pero la SALIDA no está comprobada: falta escuchar ${a} de ${b} emisiones.`,
    cadenaRespondeOyePeroHay: 'La cadena responde y se oye, pero hay avisos que degradan las pruebas.',
    cadenaAudioRespondeOyeEste: 'La cadena de audio responde Y SE OYE en este dispositivo.',
    reintentando: 'Reintentando…',
    reintentarMotorVoz: 'Reintentar el motor de voz',
    pruebaEscucha: 'Prueba de escucha',
    motorProgrameSonidoPruebaAltavoz: 'Que el motor programe un sonido no prueba que el altavoz lo emita, y la app suena por TRES vías distintas: si una falla, las otras siguen respondiendo. Reproduzca las cuatro emisiones y conteste cuáles ha oído — hasta entonces, la salida NO está comprobada.',
    haOido: '¿Lo ha oído?',
    emitiendo: 'Emitiendo…',
    repetirEmision: 'Repetir emisión',
    reproducir: 'Reproducir',
    resumenIncidencia: 'Resumen para incidencia',
    hagaCapturaEsteBloqueAdjuntela: 'Haga una captura de este bloque y adjúntela: nombra el eslabón roto sin ambigüedad.',
    nadaMideEstaPantallaGuarda: 'Nada de lo que mide esta pantalla se guarda ni se envía: se ejecuta y se muestra en el dispositivo.',
  },
  resultadosPreliminares: {
    sesionEvaluacion: 'Sesión de Evaluación',
    indiceGlobalNormalidad: 'Índice global de normalidad',
    normalidad: 'Normalidad',
    global: 'Global',
    normales: 'Normales',
    observacion: 'En Observación',
    alterados: 'Alterados',
    cargandoResultados: 'Cargando resultados…',
    sinPruebasCompletadas: 'Sin pruebas completadas',
    aquiApareceraResumenCadaModulo: 'Aquí aparecerá el resumen de cada módulo en cuanto guarde su resultado. Vuelve al hub de la batería para iniciar una prueba.',
    prueba: 'prueba',
    evaluada: 'evaluada',
    sesionActiva: '· Sesión activa',
    volverPruebas: 'Volver a pruebas',
    verInformeDetallado: 'Ver Informe Detallado',
  },
  resultadosFinal: {
    audiogramaTonalDbHl: 'Audiograma tonal · dB HL',
    campoLibreBinaural: 'Campo libre · binaural',
    oidoDerechoOd: 'Oído derecho (OD)',
    oidoIzquierdoOi: 'Oído izquierdo (OI)',
    volverResultadosPreliminares: 'Volver a resultados preliminares',
    sesionSelladaInformeListo: 'Sesión Sellada · Informe Listo',
    pruebasSesion: 'Pruebas de la sesión',
    cargandoResultados: 'Cargando resultados…',
    telemetriaZeroPhi: 'Telemetría Zero-PHI',
    qrAnonimoSesion: 'QR anónimo de la sesión',
    estaSesionTienePruebasRegistradas: 'Esta sesión no tiene pruebas registradas',
    informeComponeCadaModuloHaya: 'El informe se compone con lo que cada módulo haya guardado. Vuelve al hub de la batería y completa al menos una prueba.',
    parametrosObjetivos: 'Parámetros Objetivos',
    referencia: 'Referencia:',
    interpretacionClinica: 'Interpretación clínica',
    pendienteFirmaFacultativoResponsable: 'Pendiente de firma del facultativo responsable',
    samdClaseIiaMdr2017: 'SaMD Clase IIa · MDR 2017/745',
    exportarPdf: 'Exportar PDF',
    finalizarArchivar: 'Finalizar y Archivar',
  },
  startup: {
    appHaPodidoArrancar: 'La app no ha podido arrancar',
    falloPreparar: 'Falló al preparar',
    estaPantallaExisteFalloPueda: 'Esta pantalla existe para que el fallo se pueda leer sin cable ni logcat. Fotografíala y pásala tal cual.',
    sigueEsperando: 'Sigue esperando',
    lleva: 'lleva',
    sSinResponderHaDado: 's sin responder y no ha dado ningún error.',
    arranqueSanoTardaDecimasSegundo: 'El arranque sano tarda décimas de segundo. Si esto no cambia, el eslabón atascado es este.',
  },
} as const;

/**
 * Forma del catálogo. Los demás idiomas se declaran `const XX: UiStrings`, de
 * modo que el compilador exige TODAS las claves con la MISMA firma: una
 * función con dos parámetros aquí no puede ser una cadena suelta allí.
 */
export type UiStrings = {
  [NS in keyof typeof ES]: {
    [K in keyof (typeof ES)[NS]]: (typeof ES)[NS][K] extends (...args: infer A) => string
      ? (...args: A) => string
      : string;
  };
};
