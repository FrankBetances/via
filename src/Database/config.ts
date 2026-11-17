import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { nitroTypeOrmDriver } from './nitroTypeOrmDriver';
import { ENTITIES } from './entities';

/* -------------------------------------------------------------------------- */
/*  TypeORM DataSource — VIA+ (offline-first, SQLite local).                  */
/*                                                                            */
/*  Driver: TypeORM no publica un driver dedicado para                       */
/*  `react-native-nitro-sqlite` (no existe paquete `typeorm-nitro-sqlite-     */
/*  driver` en npm a fecha de esta fase). Se usa el driver `react-native`      */
/*  incorporado de TypeORM, que requiere inyectar un `driver` compatible con  */
/*  la API de `react-native-sqlite-storage` vía `location`. Mientras no se    */
/*  implemente/parchee un driver TypeORM <-> nitro-sqlite, este es el modo    */
/*  más estable para Fase 1. Reevaluar en una fase posterior si Margelo       */
/*  publica soporte oficial de TypeORM.                                      */
/* -------------------------------------------------------------------------- */

export const AppDataSource = new DataSource({
  type: 'react-native',
  database: 'viaplus.db',
  location: 'default',
  // TypeORM's `react-native` driver requiere que se le inyecte la librería
  // SQLite en `driver`. Se usa un driver propio sobre nitro-sqlite en modo
  // SÍNCRONO (ver nitroTypeOrmDriver.ts): el `typeORMDriver` oficial usa
  // `executeAsync` y su promesa podía no resolverse nunca en escrituras,
  // dejando bloqueadas las pantallas de registro aunque la fila sí se
  // guardara.
  driver: nitroTypeOrmDriver,
  synchronize: true,
  logging: false,
  entities: ENTITIES,
  migrations: [],
  subscribers: [],
});

let initialized = false;

/**
 * Inicializa el DataSource de TypeORM. Idempotente: llamadas repetidas
 * devuelven la misma instancia ya inicializada sin relanzar `initialize()`.
 */
export async function initDatabase(): Promise<DataSource> {
  if (!initialized || !AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    initialized = true;
  }
  return AppDataSource;
}
