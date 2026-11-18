/* -------------------------------------------------------------------------- */
/*  Reglas de acceso del profesional, EXTRAÍDAS LITERALMENTE de               */
/*  `SeleccionProfesionalScreen.tsx` (`creatingPassword` y la decisión de      */
/*  `handleConfirmPassword`) y de `RegistroProfesionalScreen.tsx`              */
/*  (`passwordOk`, `emailOk`). Sin cablear: las pantallas siguen con su copia  */
/*  hasta que Frank autorice tocarlas.                                        */
/*                                                                            */
/*  `accessRules.test.ts` compara este fichero con las pantallas leídas como   */
/*  texto.                                                                    */
/* -------------------------------------------------------------------------- */
import { hasLocalPassword, PASSWORD_MIN_LENGTH, verifyPassword } from '@/Helpers/passwordHash';

/**
 * true = el perfil no tiene contraseña local (perfil antiguo): el modal la
 * CREA en el primer acceso en vez de verificarla.
 */
export function isCreatingPassword(passwordHash: string | null | undefined): boolean {
  return !hasLocalPassword(passwordHash);
}

export type AccessDecision = 'verified' | 'incorrect' | 'too-short-to-create' | 'create';

/**
 * Decisión de `handleConfirmPassword` antes de escribir nada:
 *  · perfil con contraseña → verificar ('verified' | 'incorrect');
 *  · perfil sin contraseña → crear ('create'), si cumple el mínimo.
 */
export function decideAccess(password: string, passwordHash: string | null | undefined): AccessDecision {
  const creatingPassword = isCreatingPassword(passwordHash);
  if (!creatingPassword) {
    if (!verifyPassword(password, passwordHash as string)) {
      return 'incorrect';
    }
    return 'verified';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'too-short-to-create';
  }
  return 'create';
}

/** `passwordOk` del alta (el registro usa el literal 6). */
export const isRegistrationPasswordOk = (password: string): boolean => password.length >= 6;

/** `emailOk` del alta. */
export const isRegistrationEmailOk = (email: string): boolean => /^\S+@\S+\.\S+$/.test(email.trim());
