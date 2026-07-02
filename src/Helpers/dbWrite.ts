/* -------------------------------------------------------------------------- */
/*  writeWithVerify — escrituras SQLite a prueba de cuelgues.                 */
/*                                                                            */
/*  Síntoma observado en dispositivo: `repository.save()` (TypeORM sobre      */
/*  react-native-nitro-sqlite) a veces no llega a resolver su promesa aunque  */
/*  la fila SÍ queda persistida (al reabrir la app el registro existe). Las   */
/*  pantallas que esperan ese await se quedan bloqueadas para siempre         */
/*  (registro de profesional/paciente, CAP).                                  */
/*                                                                            */
/*  Estrategia: ejecutar la escritura con un tope de tiempo; si la promesa    */
/*  no se resuelve (o rechaza), comprobar con una LECTURA — las lecturas sí   */
/*  funcionan de forma fiable — si la fila quedó guardada. Si está, se        */
/*  continúa el flujo con esa fila; si no está, se propaga el error real.     */
/* -------------------------------------------------------------------------- */

const DEFAULT_TIMEOUT_MS = 6000;

class WriteTimeoutError extends Error {
  constructor(ms: number) {
    super(`La escritura en la base de datos local no respondió en ${Math.round(ms / 1000)} s.`);
    this.name = 'WriteTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new WriteTimeoutError(ms)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Ejecuta `write` con timeout. Si cuelga o rechaza, ejecuta `verify` (una
 * lectura que devuelve la fila si quedó persistida, o null). Con fila → se
 * devuelve esa fila y el flujo continúa; sin fila → se relanza el error
 * original para que la pantalla lo muestre.
 */
export async function writeWithVerify<T>(
  write: () => Promise<T>,
  verify: () => Promise<T | null>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  try {
    return await withTimeout(write(), timeoutMs);
  } catch (writeError) {
    console.warn('VIA+: escritura DB falló o no respondió; verificando por lectura…', writeError);
    let recovered: T | null = null;
    try {
      recovered = await withTimeout(verify(), timeoutMs);
    } catch (verifyError) {
      console.warn('VIA+: la verificación por lectura también falló', verifyError);
    }
    if (recovered) {
      console.warn('VIA+: la fila sí quedó persistida; se continúa el flujo.');
      return recovered;
    }
    throw writeError;
  }
}
