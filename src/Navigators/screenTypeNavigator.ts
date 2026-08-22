/* -------------------------------------------------------------------------- */
/*  RootStackParamList — VIA+.                                              */
/*  Fase 1: solo las rutas CORE (auth + identificación de paciente +          */
/*  créditos). Las 9 rutas de módulo (Audiometry, VoiceAnalysis, ...) y las    */
/*  pantallas nuevas basadas en mockups se añaden en fases posteriores.       */
/* -------------------------------------------------------------------------- */

export type RootStackParamList = {
  Bienvenida: undefined;
  SeleccionProfesional: undefined;
  Pacientes: undefined;
  RegistroPaciente: undefined;
  /** Consentimiento informado (bloqueante). `next`: destino tras la firma. */
  Consentimiento: { next?: 'cap' | 'dysphagia' } | undefined;
  RegistroProfesional: undefined;
  Creditos: undefined;

  // Module routes (Contrato de Compilación §2)
  ClinicalAssessment: undefined;
  Mchat: undefined;
  RoomNoiseCheck: undefined;
  Audiometry: undefined;
  AudiometryConditioned: undefined;
  VoiceAnalysis: undefined;
  ProsodyAnalysis: undefined;
  DysphagiaTest: undefined;
  SahsScreening: undefined;
  Articulation: undefined;
  VerbalAudiometry: undefined;
  ExecutiveFunctions: undefined;

  // New screen routes appended by later phases (mockup-based hub screens, etc.)
  /**
   * `noiseCheckSkipped` lo pone el botón de saltar del sonómetro: el hub sigue
   * mostrando que la sala NO está verificada en vez de anunciar un certificado
   * que nadie emitió.
   */
  SeleccionEjercicios: { noiseCheckSkipped?: boolean } | undefined;
  ResultadosPreliminares: undefined;
  ResultadosFinal: undefined;
  /** Historial de pruebas de un paciente (sesiones anteriores). */
  HistorialPaciente: { patientId: number; patientName: string; nhc?: string };
  /**
   * Comprobación de audio del dispositivo. No es un módulo clínico: es la
   * pantalla que nombra qué eslabón de la cadena de audio está roto cuando
   * las pruebas de voz no suenan o no graban.
   */
  DiagnosticoAudio: undefined;
};

declare global {
   
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
