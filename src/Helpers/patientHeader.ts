/* -------------------------------------------------------------------------- */
/*  Cabecera de paciente de las pantallas de sesión (hub y resultados).        */
/*                                                                            */
/*  Existe para que ninguna de las tres pantallas vuelva a rellenar la         */
/*  cabecera con un paciente de ejemplo: si no hay paciente asignado se dice   */
/*  que no lo hay. Un nombre inventado en la cabecera de un informe clínico    */
/*  es indistinguible de uno real para quien mira la tableta.                  */
/*                                                                            */
/*  La vista de paciente del slice (`ActiveEvaluationPatientView`) no lleva    */
/*  fecha de nacimiento, así que aquí NO se compone ninguna edad: la que se    */
/*  mostraba («5 años») era un literal del mockup.                             */
/* -------------------------------------------------------------------------- */

export interface PatientHeaderSource {
  name?: string | null;
  lastName?: string | null;
  nhc?: string | null;
}

export interface PatientHeader {
  /** Texto de la píldora: «Nombre Apellido · NHC-48920», o el aviso de que falta. */
  patientLabel: string;
  /** Iniciales del monograma; «—» cuando no hay paciente. */
  initials: string;
  /** ¿Hay realmente un paciente asignado a la sesión? */
  hasPatient: boolean;
}

const EMPTY: PatientHeader = {
  patientLabel: 'Sin paciente asignado',
  initials: '—',
  hasPatient: false,
};

export function describePatient(patient: PatientHeaderSource | null | undefined): PatientHeader {
  if (!patient) return EMPTY;

  const fullName = `${patient.name ?? ''} ${patient.lastName ?? ''}`.trim();
  if (!fullName) return EMPTY;

  const initials =
    fullName
      .split(/\s+/)
      .map(w => w.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase() || '—';

  const nhc = patient.nhc?.trim();

  return {
    patientLabel: nhc ? `${fullName} · NHC-${nhc}` : fullName,
    initials,
    hasPatient: true,
  };
}
