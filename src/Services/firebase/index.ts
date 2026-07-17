export {
  describeAuthError,
  getCurrentUser,
  isFirebaseAvailable,
  registerWithEmail,
  signInWithEmail,
  signOutQuietly,
  subscribeToAuthState,
} from './auth';
export type { FirebaseUser } from './auth';

export { getProfessionalProfile, saveProfessionalProfile } from './professionals';
export type { ProfessionalProfile } from './professionals';
