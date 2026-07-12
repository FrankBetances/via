import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from '@react-native-firebase/auth';

/* -------------------------------------------------------------------------- */
/*  Servicio de autenticación (Firebase Authentication, email/contraseña).     */
/*  La sesión de la app sigue viviendo en Redux (authSlice, solo en memoria);  */
/*  Firebase aporta la verificación de credenciales y el `uid` que ancla el    */
/*  perfil del profesional en Firestore (professionals/{uid}).                 */
/* -------------------------------------------------------------------------- */

export type FirebaseUser = User;

/** Da de alta al profesional en Firebase Auth y devuelve su usuario. */
export async function registerWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const credential = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
  return credential.user;
}

/** Inicia sesión con email/contraseña y devuelve el usuario autenticado. */
export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(getAuth(), email.trim(), password);
  return credential.user;
}

/** Usuario de Firebase con sesión activa (o null). */
export function getCurrentUser(): FirebaseUser | null {
  return getAuth().currentUser;
}

/** Suscripción a cambios de sesión; devuelve la función de desuscripción. */
export function subscribeToAuthState(listener: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(getAuth(), listener);
}

/**
 * Cierra la sesión de Firebase sin propagar errores: el logout de la app
 * (Redux) no debe bloquearse porque el signOut remoto falle sin red.
 */
export function signOutQuietly(): void {
  signOut(getAuth()).catch(() => {
    /* sin sesión remota que cerrar o sin conectividad: irrelevante */
  });
}

/**
 * Traducción de códigos de error de Firebase Auth a mensajes accionables en
 * castellano (los profesionales evalúan en español).
 */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese email. Prueba a acceder con tu contraseña.';
    case 'auth/invalid-email':
      return 'El email no tiene un formato válido.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil: usa al menos 6 caracteres.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espera unos minutos y vuelve a intentarlo.';
    case 'auth/network-request-failed':
      return 'Sin conexión con el servidor. Comprueba tu acceso a internet.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada. Contacta con el administrador.';
    default:
      return error instanceof Error && error.message ? error.message : 'Error de autenticación desconocido.';
  }
}
