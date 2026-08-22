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
  nameEnc?: string | null;
  idHash?: string | null;
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

/**
 * ¿Este valor parece un criptograma o un hash en vez de un nombre? Se comprueba
 * por FORMA, no por longitud: un nombre real lleva espacios o caracteres fuera
 * del alfabeto base64/hex, mientras que un blob es una tirada larga y continua
 * de base64 (con su relleno `=`) o de hexadecimal.
 */
function looksOpaque(value: string): boolean {
  if (!value || /\s/.test(value)) return false;
  if (value.length < 24) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) || /^[0-9a-f]+$/i.test(value);
}

export function describePatient(patient: PatientHeaderSource | null | undefined): PatientHeader {
  if (!patient) return EMPTY;

  const directName = patient.name?.trim() || '';
  const directLastName = patient.lastName?.trim() || '';
  const directCombined = `${directName} ${directLastName}`.trim();

  // `nameEnc` es el campo AES-256-GCM del modelo. En Fase 1 todavía guarda el
  // nombre en claro y por eso sirve de respaldo para los objetos planos que no
  // pasan por la clase `Patient`. En cuanto la capa de seguridad cifre de
  // verdad, ese respaldo pintaría el blob en la cabecera de todas las
  // pantallas: `looksOpaque` lo descarta antes de que eso ocurra, de modo que
  // la cabecera se quede vacía —recuperable— en vez de mostrar criptograma.
  const encRaw = patient.nameEnc?.trim() || '';
  const encName = looksOpaque(encRaw) ? '' : encRaw;

  const fullName = directCombined || encName;
  if (!fullName) return EMPTY;

  const initials =
    fullName
      .split(/\s+/)
      .map(w => w.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase() || '—';

  const nhc = (patient.nhc?.trim() || patient.idHash?.trim() || '');

  return {
    patientLabel: nhc ? `${fullName} · NHC-${nhc}` : fullName,
    initials,
    hasPatient: true,
  };
}
