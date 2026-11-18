/* -------------------------------------------------------------------------- */
/*  Reglas de menor de edad y de firmante del consentimiento, EXTRAÍDAS        */
/*  LITERALMENTE de `ConsentimientoScreen.tsx` (sin cablear: la pantalla       */
/*  sigue llevando su copia hasta que Frank autorice tocarla).                 */
/*                                                                            */
/*  `consentRules.test.ts` compara este fichero con la pantalla leída como     */
/*  texto: si una de las dos cambia sin la otra, el test falla.               */
/* -------------------------------------------------------------------------- */

export type ConsentSignerType = 'patient' | 'guardian' | 'family';

/** Edad en años cumplidos a partir de 'AAAA-MM-DD'; null si no es interpretable. */
export function ageFromDob(isoDob: string | null | undefined): number | null {
  if (!isoDob || !/^\d{4}-\d{2}-\d{2}$/.test(isoDob.trim())) return null;
  const dob = new Date(`${isoDob.trim()}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  if (
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  ) {
    years -= 1;
  }
  return years;
}

/** `const minor = age < 18;` de la pantalla. */
export function isMinorAge(age: number): boolean {
  const minor = age < 18;
  return minor;
}

/** Opciones de firmante según `isMinor` (null = edad desconocida). */
export function signerOptionsFor(isMinor: boolean | null) {
  const guardian = { value: 'guardian' as const, label: 'Padre/Madre/Tutor' };
  const patient = { value: 'patient' as const, label: 'El propio paciente' };
  const family = { value: 'family' as const, label: 'Familiar/representante' };
  if (isMinor === true) return [guardian];
  if (isMinor === false) return [patient, family];
  return [guardian, patient, family];
}

/** ¿Está completo el formulario de firma? (`ready` de la pantalla). */
export function consentReady(input: {
  signerType: ConsentSignerType;
  signerName: string;
  signerRelation: string;
  incapacityReason: string;
  agreed: boolean[];
  signaturePaths: string[];
}): boolean {
  const { signerType, signerName, signerRelation, incapacityReason, agreed, signaturePaths } = input;
  const needsRelation = signerType !== 'patient';
  const needsReason = signerType === 'family';
  return (
    !!signerName.trim() &&
    (!needsRelation || !!signerRelation.trim()) &&
    (!needsReason || !!incapacityReason.trim()) &&
    agreed.every(Boolean) &&
    signaturePaths.length > 0
  );
}
