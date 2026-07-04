import { open } from 'react-native-nitro-sqlite';

/* -------------------------------------------------------------------------- */
/*  nitroTypeOrmDriver — driver TypeORM sobre nitro-sqlite en modo SÍNCRONO.   */
/*                                                                            */
/*  El `typeORMDriver` que publica react-native-nitro-sqlite usa               */
/*  `executeAsync`, cuya promesa cruza el puente Nitro y en dispositivo se ha  */
/*  observado que en escrituras (INSERT/UPDATE) puede no resolverse nunca      */
/*  aunque la fila SÍ quede persistida. Todas las pantallas que esperaban ese  */
/*  await quedaban bloqueadas (registro de profesional, de paciente, CAP…).    */
/*                                                                            */
/*  Este driver usa `execute` (JSI síncrono): el resultado vuelve en la misma  */
/*  llamada, sin promesa nativa que pueda perderse. Con una base de datos       */
/*  local pequeña el coste por consulta es de microsegundos y elimina la       */
/*  clase entera de cuelgues. Además normaliza los parámetros a los tipos      */
/*  que acepta Nitro (string/number/boolean/ArrayBuffer/null): TypeORM puede   */
/*  pasar `undefined` o `Date`, que el puente nativo no admite.               */
/* -------------------------------------------------------------------------- */

type SqlOk = (result: unknown) => void;
type SqlFail = (error: unknown) => void;

interface OpenOptions {
  name: string;
  location?: string;
}

function sanitizeParams(params?: unknown[]): any[] | undefined {
  if (!params) return params as undefined;
  return params.map(p => {
    if (p === undefined || p === null) return null;
    if (p instanceof Date) return p.toISOString();
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'number' || typeof p === 'string') return p;
    if (p instanceof ArrayBuffer) return p;
    return String(p);
  });
}

export const nitroTypeOrmDriver = {
  openDatabase: (options: OpenOptions, ok: (db: unknown) => void, fail: SqlFail) => {
    try {
      const db = open({ name: options.name, location: options.location });
      const connection = {
        executeSql: (sql: string, params: unknown[] | undefined, okExecute: SqlOk, failExecute: SqlFail) => {
          try {
            const result = db.execute(sql, sanitizeParams(params));
            okExecute(result);
          } catch (e) {
            failExecute(e);
          }
        },
        transaction: (fn: unknown) => db.transaction(fn as any),
        close: (okClose: () => void, failClose: SqlFail) => {
          try {
            db.close();
            okClose();
          } catch (e) {
            failClose(e);
          }
        },
        attach: (dbNameToAttach: string, alias: string, location: string | undefined, callback: () => void) => {
          db.attach(dbNameToAttach, alias, location);
          callback();
        },
        detach: (alias: string, callback: () => void) => {
          db.detach(alias);
          callback();
        },
      };
      ok(connection);
      return connection;
    } catch (e) {
      fail(e);
      return null;
    }
  },
};
