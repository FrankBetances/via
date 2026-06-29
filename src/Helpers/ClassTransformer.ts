import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { plainToInstance } from 'class-transformer';
import { RootState } from '@/Store';

/* -------------------------------------------------------------------------- */
/*  useClassSelector — helper compartido por las 9 pantallas de módulo.       */
/*                                                                            */
/*  Las pantallas de módulo leen entidades (p.ej. `Evaluation`) desde Redux   */
/*  como objetos planos (serializables) pero las usan como instancias de      */
/*  clase (decoradores de `class-transformer`, getters, etc.). Este hook      */
/*  selecciona el slice indicado y lo transforma en una instancia de `cls`    */
/*  con `plainToInstance`, memoizando por referencia para evitar              */
/*  transformaciones repetidas en cada render.                                */
/* -------------------------------------------------------------------------- */

export function useClassSelector<TPlain, TClass>(
  cls: new () => TClass,
  selector: (state: RootState) => TPlain | null | undefined,
): TClass | null {
  const plain = useSelector(selector);

  return useMemo(() => {
    if (plain === null || plain === undefined) return null;
    return plainToInstance(cls, plain as object) as TClass;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plain, cls]);
}
