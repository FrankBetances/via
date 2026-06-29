import { useCallback, useRef, useState } from 'react';

/* -------------------------------------------------------------------------- */
/*  Servicio local "RTK-Query-like" — VIA+.                                  */
/*                                                                            */
/*  No usamos RTK Query real (no hay backend remoto que cachear: toda la      */
/*  persistencia es local vía TypeORM/SQLite, offline-first). Estos tres      */
/*  helpers envuelven una función async de repositorio en un hook con la      */
/*  MISMA FORMA que los hooks de RTK Query que las pantallas de los 9         */
/*  módulos ya importan (`useCreateXMutation`, `useGetXByIdQuery`,            */
/*  `useLazyGetXByIdQuery`, ...). Ver Contrato de Compilación §5.             */
/*                                                                            */
/*  Contrato de firmas (NO cambiar sin actualizar todos los módulos):         */
/*    createLocalMutation<TResult, TInput>(fn) => hook                       */
/*      hook(): [trigger: (input: TInput) => Promise<TResult>, state]        */
/*      state: { data, isLoading, isSuccess, isError, error, reset }         */
/*                                                                            */
/*    createLocalQuery<TResult, TArg>(fn) => hook                            */
/*      hook(arg: TArg, options?: { skip?: boolean }) => state               */
/*      state: { data, isLoading, isFetching, isSuccess, isError, error,     */
/*               refetch }                                                   */
/*      Se ejecuta automáticamente cuando `arg` cambia (salvo `skip`).        */
/*                                                                            */
/*    createLocalLazyQuery<TResult, TArg>(fn) => hook                        */
/*      hook() => [trigger: (arg: TArg) => Promise<TResult>, state]          */
/*      state: misma forma que createLocalQuery (sin auto-fetch).            */
/* -------------------------------------------------------------------------- */

export interface LocalMutationState<TResult> {
  data: TResult | undefined;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
  reset: () => void;
}

export type LocalMutationTrigger<TResult, TInput> = (input: TInput) => Promise<TResult>;

export type UseLocalMutationHook<TResult, TInput> = () => [
  LocalMutationTrigger<TResult, TInput>,
  LocalMutationState<TResult>,
];

/**
 * Envuelve una función async de repositorio (create/update/delete) en un hook
 * con forma de mutation. `fn` no se ejecuta hasta que se invoca el `trigger`
 * devuelto en la primera posición de la tupla.
 */
export function createLocalMutation<TResult, TInput = void>(
  fn: (input: TInput) => Promise<TResult>,
): UseLocalMutationHook<TResult, TInput> {
  return function useLocalMutation() {
    const [data, setData] = useState<TResult | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<unknown>(undefined);

    const reset = useCallback(() => {
      setData(undefined);
      setIsLoading(false);
      setIsSuccess(false);
      setIsError(false);
      setError(undefined);
    }, []);

    const trigger = useCallback(
      async (input: TInput) => {
        setIsLoading(true);
        setIsError(false);
        setError(undefined);
        try {
          const result = await fn(input);
          setData(result);
          setIsSuccess(true);
          return result;
        } catch (err) {
          setIsError(true);
          setError(err);
          throw err;
        } finally {
          setIsLoading(false);
        }
      },
      [],
    );

    return [trigger, { data, isLoading, isSuccess, isError, error, reset }];
  };
}

export interface LocalQueryState<TResult> {
  data: TResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<TResult | undefined>;
}

export type UseLocalQueryHook<TResult, TArg> = (
  arg: TArg,
  options?: { skip?: boolean },
) => LocalQueryState<TResult>;

/**
 * Envuelve una función async de repositorio (getById/getByEvaluation, etc.)
 * en un hook con forma de query: se auto-ejecuta cuando `arg` cambia, salvo
 * que `options.skip` sea true.
 */
export function createLocalQuery<TResult, TArg = void>(
  fn: (arg: TArg) => Promise<TResult>,
): UseLocalQueryHook<TResult, TArg> {
  return function useLocalQuery(arg: TArg, options?: { skip?: boolean }) {
    const skip = options?.skip ?? false;
    const [data, setData] = useState<TResult | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(!skip);
    const [isFetching, setIsFetching] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<unknown>(undefined);
    const argRef = useRef(arg);
    argRef.current = arg;

    const execute = useCallback(async () => {
      if (skip) return undefined;
      setIsFetching(true);
      setIsError(false);
      setError(undefined);
      try {
        const result = await fn(argRef.current);
        setData(result);
        setIsSuccess(true);
        return result;
      } catch (err) {
        setIsError(true);
        setError(err);
        return undefined;
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    }, [skip]);

    // Auto-fetch on mount / when `arg` (by reference/value) or `skip` changes.
    useState(() => {
      execute();
      return null;
    });

    return { data, isLoading, isFetching, isSuccess, isError, error, refetch: execute };
  };
}

export type UseLocalLazyQueryHook<TResult, TArg> = () => [
  (arg: TArg) => Promise<TResult>,
  LocalQueryState<TResult>,
];

/**
 * Envuelve una función async de repositorio en un hook con forma de lazy
 * query: no se ejecuta hasta llamar al `trigger` devuelto.
 */
export function createLocalLazyQuery<TResult, TArg = void>(
  fn: (arg: TArg) => Promise<TResult>,
): UseLocalLazyQueryHook<TResult, TArg> {
  return function useLocalLazyQuery() {
    const [data, setData] = useState<TResult | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<unknown>(undefined);
    const lastArgRef = useRef<TArg | undefined>(undefined);

    const refetch = useCallback(async () => {
      if (lastArgRef.current === undefined) return undefined;
      return trigger(lastArgRef.current as TArg);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const trigger = useCallback(
      async (arg: TArg) => {
        lastArgRef.current = arg;
        setIsLoading(true);
        setIsFetching(true);
        setIsError(false);
        setError(undefined);
        try {
          const result = await fn(arg);
          setData(result);
          setIsSuccess(true);
          return result;
        } catch (err) {
          setIsError(true);
          setError(err);
          throw err;
        } finally {
          setIsLoading(false);
          setIsFetching(false);
        }
      },
      [],
    );

    return [trigger, { data, isLoading, isFetching, isSuccess, isError, error, refetch }];
  };
}
