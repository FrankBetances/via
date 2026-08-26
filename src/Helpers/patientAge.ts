/* -------------------------------------------------------------------------- */
/*  Edad del paciente a partir de la fecha de nacimiento de la ficha.          */
/*                                                                            */
/*  `Patient.dobEnc` guarda la fecha como 'AAAA-MM-DD' (sin cifrado real en    */
/*  Fase 1, ver `Models/Patient`). Los módulos de primera infancia razonan en  */
/*  MESES, no en años: entre 0 y 5 años la diferencia entre 13 y 18 meses      */
/*  cambia la banda normativa entera.                                          */
/*                                                                            */
/*  Ambas funciones devuelven `null` cuando la fecha no es interpretable, y    */
/*  eso NO se debe traducir a un valor por defecto silencioso: una banda de    */
/*  edad elegida por la app sin saber la edad es un dato clínico inventado.    */
/*  Quien llame tiene que DECIR que no pudo deducirla.                        */
/* -------------------------------------------------------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de nacimiento interpretable, o `null`. */
export function parseDob(isoDob: string | null | undefined): Date | null {
  if (!isoDob || !ISO_DATE.test(isoDob.trim())) return null;
  const dob = new Date(`${isoDob.trim()}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  return dob;
}

/** Meses cumplidos desde `isoDob` hasta `now`; `null` si la fecha no vale. */
export function ageInMonthsFromDob(
  isoDob: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const dob = parseDob(isoDob);
  if (!dob) return null;
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  // El mes en curso solo cuenta si ya se pasó el día del cumpleaños.
  if (now.getDate() < dob.getDate()) months -= 1;
  return months < 0 ? null : months;
}

/** Años cumplidos desde `isoDob`; `null` si la fecha no vale. */
export function ageInYearsFromDob(
  isoDob: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const months = ageInMonthsFromDob(isoDob, now);
  return months == null ? null : Math.floor(months / 12);
}
