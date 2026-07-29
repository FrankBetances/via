import AsyncStorage from '@react-native-async-storage/async-storage';

import { getNoiseCalibrationOffset, setNoiseCalibrationOffset } from './noiseDsp';

/* -------------------------------------------------------------------------- */
/*  Persistencia de la calibración de campo del sonómetro.                     */
/*                                                                             */
/*  El offset vivía SOLO en una variable del módulo DSP: se perdía al cerrar   */
/*  la app, así que el clínico que había anclado la lectura a su sonómetro     */
/*  patrón se encontraba el ajuste a cero en la sesión siguiente y volvía a    */
/*  medir «descalibrado». La corrección es una propiedad del DISPOSITIVO (su   */
/*  micrófono), no de la sesión, así que se guarda en el almacenamiento local  */
/*  del terminal.                                                              */
/*                                                                             */
/*  Zero-PHI: el valor guardado es un número de dB del propio equipo; no       */
/*  contiene ningún dato del paciente ni del profesional.                       */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = 'via.noise.calibrationOffsetDb';

/**
 * Carga el offset guardado y lo aplica al DSP. Devuelve el offset vigente
 * (0 si no había nada guardado o el almacenamiento falló: la medición debe
 * seguir funcionando aunque no se pueda leer la preferencia).
 */
export async function loadNoiseCalibration(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return getNoiseCalibrationOffset();
    const parsed = Number(raw);
    return setNoiseCalibrationOffset(Number.isFinite(parsed) ? parsed : 0);
  } catch {
    return getNoiseCalibrationOffset();
  }
}

/**
 * Aplica un offset nuevo y lo persiste. Devuelve el valor realmente aplicado
 * (acotado por el DSP). La escritura es «mejor esfuerzo»: si falla, el ajuste
 * sigue vigente en esta sesión.
 */
export async function saveNoiseCalibration(db: number): Promise<number> {
  const applied = setNoiseCalibrationOffset(db);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(applied));
  } catch {
    /* el ajuste vale para esta sesión aunque no se haya podido guardar */
  }
  return applied;
}
