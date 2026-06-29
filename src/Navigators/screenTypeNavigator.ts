/* -------------------------------------------------------------------------- */
/*  RootStackParamList — VIA+.                                              */
/*  Fase 1: solo las rutas CORE (auth + identificación de paciente +          */
/*  créditos). Las 9 rutas de módulo (Audiometry, VoiceAnalysis, ...) y las    */
/*  pantallas nuevas basadas en mockups se añaden en fases posteriores.       */
/* -------------------------------------------------------------------------- */

export type RootStackParamList = {
  Login: undefined;
  Pacientes: undefined;
  RegistroPaciente: undefined;
  RegistroProfesional: undefined;
  Creditos: undefined;

  // Module + new screen routes appended by later phases
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
