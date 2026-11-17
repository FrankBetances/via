/* -------------------------------------------------------------------------- */
/*  Banco de persistencia en Node: SQLite en memoria (sql.js) con LAS MISMAS   */
/*  entidades que la base real (`src/Database/entities.ts`).                   */
/*                                                                            */
/*  Uso, en la suite que quiera ejecutar los repositorios REALES:             */
/*                                                                            */
/*    jest.mock('@/Database/config', () =>                                    */
/*      require('../../../jest/memoryDataSource').configMock());*/
/*    import { AppDataSource } from '@/Database/config';                       */
/*    beforeAll(() => AppDataSource.initialize());                             */
/*    afterAll(() => AppDataSource.destroy());                                 */
/*                                                                            */
/*  QUÉ NO PRUEBA: sql.js es SQLite compilado a WASM, no el driver nitro-sqlite */
/*  del dispositivo (`nitroTypeOrmDriver.ts`). Cubre el esquema, las           */
/*  consultas y los transformadores de columnas; NO cubre el cuelgue de        */
/*  `save()` en dispositivo ni el coste en Hermes.                            */
/* -------------------------------------------------------------------------- */
import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { ENTITIES } from '@/Database/entities';

export function createMemoryDataSource(): DataSource {
  return new DataSource({
    type: 'sqljs',
    synchronize: true,
    logging: false,
    entities: ENTITIES,
    migrations: [],
    subscribers: [],
  });
}

/** Sustituto de `@/Database/config` (misma forma pública que usan los repositorios). */
export function configMock(): {
  AppDataSource: DataSource;
  initDatabase: () => Promise<DataSource>;
} {
  const AppDataSource = createMemoryDataSource();
  return {
    AppDataSource,
    initDatabase: async () => {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      return AppDataSource;
    },
  };
}
