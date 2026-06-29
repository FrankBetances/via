import { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/* -------------------------------------------------------------------------- */
/*  Helper de repositorio TypeORM — VIA+.                                    */
/*                                                                            */
/*  Los repositorios de referencia (code/Repositories/*.ts) NO comparten una  */
/*  clase base: cada uno es un singleton independiente con `getInstance()` +  */
/*  `initialize()` + métodos estáticos `create<X>` / `update<X>` /            */
/*  `get<X>ById` / `get<X>ByEvaluation` / `delete<X>` / `deleteAll<X>s`.       */
/*  Esta función NO sustituye ese patrón (las firmas estáticas siguen         */
/*  escribiéndose a mano por repositorio para mantener nombres EXACTOS por    */
/*  módulo, ver Contrato de Compilación §2/§5), pero factoriza el boilerplate  */
/*  de obtención lazy del `Repository<T>` de TypeORM para que los nuevos      */
/*  repositorios de módulo no tengan que repetir el patrón init/getRepository.*/
/*                                                                            */
/*  Uso típico dentro de un repositorio de módulo:                            */
/*                                                                            */
/*    const getRepo = lazyRepository(DysphagiaTest);                        */
/*    export class DysphagiaTestRepository {                                */
/*      static async createDysphagia(item: DysphagiaTest) {                  */
/*        return (await getRepo()).save(item);                              */
/*      }                                                                    */
/*    }                                                                      */
/* -------------------------------------------------------------------------- */

export function lazyRepository<Entity extends ObjectLiteral>(
  target: EntityTarget<Entity>,
): () => Promise<Repository<Entity>> {
  let repository: Repository<Entity> | null = null;

  return async function getRepository(): Promise<Repository<Entity>> {
    if (!repository) {
      repository = AppDataSource.getRepository(target);
    }
    return repository;
  };
}
