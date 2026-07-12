import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';

import { ProfessionalRole } from '@/Models/Professional/Professional';

/* -------------------------------------------------------------------------- */
/*  Perfil del profesional en Cloud Firestore: professionals/{uid}.            */
/*  El documento se ancla al uid de Firebase Auth; las reglas de seguridad     */
/*  (firestore.rules) solo permiten leer/escribir al propio profesional.      */
/*  NUNCA se sincronizan datos de pacientes aquí: solo el perfil del           */
/*  evaluador (ver README §Privacidad — los datos clínicos son locales).       */
/* -------------------------------------------------------------------------- */

export interface ProfessionalProfile {
  fullName: string;
  role: ProfessionalRole;
  licenseNumber: string;
  email: string;
}

const COLLECTION = 'professionals';

/** Crea o actualiza (merge) el perfil del profesional autenticado. */
export async function saveProfessionalProfile(uid: string, profile: ProfessionalProfile): Promise<void> {
  const db = getFirestore();
  await setDoc(
    doc(db, COLLECTION, uid),
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Recupera el perfil remoto del profesional (null si aún no existe). */
export async function getProfessionalProfile(uid: string): Promise<ProfessionalProfile | null> {
  const snapshot = await getDoc(doc(getFirestore(), COLLECTION, uid));
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data() as Partial<ProfessionalProfile> | undefined;
  if (!data?.fullName || !data.role) {
    return null;
  }
  return {
    fullName: data.fullName,
    role: data.role,
    licenseNumber: data.licenseNumber ?? '',
    email: data.email ?? '',
  };
}
