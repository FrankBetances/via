/* -------------------------------------------------------------------------- */
/*  describeError — convierte cualquier cosa lanzada en texto que se pueda     */
/*  PINTAR EN PANTALLA.                                                        */
/*                                                                            */
/*  POR QUÉ EXISTE                                                             */
/*  En un APK de release no hay consola. `console.error(err)` es exactamente   */
/*  igual de útil que no escribir nada (regla 4), y hasta ahora era el único   */
/*  sitio donde iba a parar un fallo de arranque: la app se quedaba en el      */
/*  splash para siempre y desde fuera es indistinguible de «se ha colgado».    */
/*                                                                            */
/*  Lo que se lanza en el arranque no es siempre un `Error`: el puente nativo  */
/*  puede devolver un objeto plano con `code`/`message`, TypeORM lanza errores */
/*  con `driverError` anidado y una promesa puede rechazarse con una cadena.   */
/*  Por eso esto no hace `String(e)` a secas: eso produce «[object Object]»,   */
/*  que es otra forma de no decir nada.                                        */
/* -------------------------------------------------------------------------- */

export interface DescribedError {
  /** Una línea: lo que se enseña en grande. Nunca vacío. */
  message: string;
  /** Todo lo demás (código nativo, causa, pila). `null` si no hay nada más. */
  detail: string | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const textOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

export function describeError(error: unknown): DescribedError {
  if (error === undefined || error === null) {
    return { message: 'Fallo sin mensaje (no se lanzó ningún objeto de error).', detail: null };
  }

  const direct = textOf(error);
  if (direct) return { message: direct, detail: null };

  const record = asRecord(error);
  if (!record) {
    return { message: `Fallo de tipo ${typeof error}, sin mensaje.`, detail: null };
  }

  const message =
    textOf(record.message) ??
    textOf(record.reason) ??
    textOf(record.code) ??
    'Fallo sin mensaje.';

  const lines: string[] = [];
  const code = textOf(record.code);
  if (code && code !== message) lines.push(`código: ${code}`);
  const name = textOf(record.name);
  if (name && name !== 'Error' && name !== message) lines.push(`tipo: ${name}`);

  /* TypeORM envuelve el error real del driver; sin esto se leería siempre el
   * genérico «Driver not Connected» y nunca lo que dijo SQLite. */
  const driver = asRecord(record.driverError);
  const driverMessage = driver ? textOf(driver.message) : null;
  if (driverMessage && driverMessage !== message) lines.push(`driver: ${driverMessage}`);

  const cause = asRecord(record.cause);
  const causeMessage = cause ? textOf(cause.message) : textOf(record.cause);
  if (causeMessage && causeMessage !== message) lines.push(`causa: ${causeMessage}`);

  const stack = textOf(record.stack);
  if (stack) lines.push(stack);

  return { message, detail: lines.length > 0 ? lines.join('\n') : null };
}
