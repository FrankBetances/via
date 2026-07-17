import { getApps } from '@react-native-firebase/app';
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

/**
 * true si el build inicializó la app nativa de Firebase (es decir, si se
 * compiló con android/app/google-services.json o GoogleService-Info.plist).
 * Sin ese fichero `getAuth()` lanza y las pantallas deben degradar a modo
 * solo local en lugar de bloquearse.
 */
export function isFirebaseAvailable(): boolean {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
}

// Las llamadas a Firebase Auth son bloqueantes para la UI (el botón muestra
// spinner): un tope de tiempo garantiza que una red colgada nunca deje la
// pantalla girando indefinidamente.
const AUTH_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error('Tiempo de espera agotado hablando con Firebase.');
      (error as Error & { code: string }).code = 'via/auth-timeout';
      reject(error);
    }, AUTH_TIMEOUT_MS);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Da de alta al profesional en Firebase Auth y devuelve su usuario. */
export async function registerWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const credential = await withTimeout(createUserWithEmailAndPassword(getAuth(), email.trim(), password));
  return credential.user;
}

/** Inicia sesión con email/contraseña y devuelve el usuario autenticado. */
export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const credential = await withTimeout(signInWithEmailAndPassword(getAuth(), email.trim(), password));
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
    case 'via/auth-timeout':
      return 'Sin conexión con el servidor. Comprueba tu acceso a internet.';
    case 'auth/operation-not-allowed':
      return 'El acceso con email/contraseña no está habilitado en el proyecto de Firebase (consola → Authentication → Sign-in method).';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada. Contacta con el administrador.';
    default:
      return error instanceof Error && error.message ? error.message : 'Error de autenticación desconocido.';
  }
}
