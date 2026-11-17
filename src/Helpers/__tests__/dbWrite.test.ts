import { writeWithVerify } from '@/Helpers/dbWrite';

/* `writeWithVerify` no exporta WriteTimeoutError: se identifica por nombre y mensaje. */
const NEVER = <T>(): Promise<T> => new Promise<T>(() => {});

describe('writeWithVerify', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    jest.useRealTimers();
  });

  it('(a) la escritura resuelve a tiempo: devuelve su valor y NO verifica', async () => {
    const verify = jest.fn(async () => ({ id: 99 }));
    const result = await writeWithVerify(async () => ({ id: 1 }), verify, 1000);
    expect(result).toEqual({ id: 1 });
    expect(verify).not.toHaveBeenCalled();
  });

  it('(b) la escritura no resuelve y la verificación encuentra la fila: devuelve la fila', async () => {
    const row = { id: 7 };
    const promise = writeWithVerify(() => NEVER<{ id: number }>(), async () => row, 1000);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe(row);
  });

  it('(c) no resuelve y la verificación devuelve null: relanza el WriteTimeoutError original', async () => {
    const promise = writeWithVerify(() => NEVER<{ id: number }>(), async () => null, 1000);
    const settled = promise.catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(1000);
    expect(await settled).toMatchObject({
      name: 'WriteTimeoutError',
      message: expect.stringContaining('no respondió en 1 s'),
    });
  });

  it('(d) la escritura rechaza y la verificación encuentra la fila: devuelve la fila', async () => {
    const row = { id: 8 };
    const result = await writeWithVerify(
      async () => {
        throw new Error('SQLITE_BUSY');
      },
      async () => row,
      1000,
    );
    expect(result).toBe(row);
  });

  it('(e) la verificación también cuelga: relanza el error original de la escritura', async () => {
    const original = new Error('SQLITE_BUSY');
    const promise = writeWithVerify(
      async () => {
        throw original;
      },
      () => NEVER<{ id: number } | null>(),
      1000,
    );
    const settled = promise.catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(1000);
    expect(await settled).toBe(original);
  });
});
