/* -------------------------------------------------------------------------- */
/*  Utilidades de los tests de ida y vuelta de repositorios (B2).             */
/*  Se apoyan en `jest/memoryDataSource.ts` (sql.js): NO es el driver         */
/*  nitro-sqlite del dispositivo. Cada suite que lo use debe declarar antes   */
/*    jest.mock('@/Database/config', () =>                                    */
/*      require('../../../jest/memoryDataSource').configMock());              */
/* -------------------------------------------------------------------------- */
import { AppDataSource } from '@/Database/config';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Patient } from '@/Models/Patient/Patient';
import { Professional } from '@/Models/Professional/Professional';

let counter = 0;

/** Crea paciente + profesional + evaluación reales y devuelve la evaluación. */
export async function makeEvaluation(tag = 'ev'): Promise<Evaluation> {
  counter += 1;
  const patient = await AppDataSource.getRepository(Patient).save(
    Object.assign(new Patient(), {
      idHash: `hash-${tag}-${counter}`,
      nameEnc: 'enc-nombre',
      dobEnc: 'enc-fecha',
      sex: 'F',
    }),
  );
  const professional = await AppDataSource.getRepository(Professional).save(
    Object.assign(new Professional(), { fullName: `Pro ${tag} ${counter}`, role: 'logopeda' }),
  );
  return AppDataSource.getRepository(Evaluation).save(
    Object.assign(new Evaluation(), { patient, professional, status: 'in_progress' }),
  );
}

export interface RoundTripConfig<T extends { id: number; evaluation: Evaluation }> {
  /** Entidad nueva, SIN id, ligada a `ev`; `completedAt` lo fija el helper. */
  build: (ev: Evaluation, i: number) => T;
  /** Campos de carga útil que deben volver idénticos (toEqual). */
  fields: Array<keyof T>;
  /** Campo que `mutate` cambia (para comprobar el update). */
  mutatedField: keyof T;
  create: (item: T) => Promise<T>;
  getById: (id: number) => Promise<T | null>;
  getByEvaluation: (evaluationId: number) => Promise<T[]>;
  /** Modifica en sitio `mutatedField`. */
  mutate: (item: T) => void;
  update?: (item: T) => Promise<T>;
  remove?: (id: number) => Promise<void>;
}

export function sameDate(a: unknown, b: Date): boolean {
  return new Date(a as Date).getTime() === b.getTime();
}

type WithDates = { completedAt: Date; createdAt: Date };

/**
 * Registra los `it` comunes: guardar -> leer por id -> mismos datos; fechas;
 * filtro por evaluación sin mezclar; orden por completedAt DESC; update; delete.
 */
export function registerRoundTrip<T extends { id: number; evaluation: Evaluation }>(
  cfg: RoundTripConfig<T>,
  evals: () => { a: Evaluation; b: Evaluation },
): void {
  const t0 = new Date('2026-11-10T09:15:30.123Z');
  const t1 = new Date('2026-11-12T18:45:00.456Z');

  const make = (ev: Evaluation, i: number, when: Date): T => {
    const e = cfg.build(ev, i);
    (e as unknown as WithDates).completedAt = when;
    return e;
  };

  it('guarda y lee por id con los mismos datos, la evaluación y las fechas', async () => {
    const { a } = evals();
    const saved = await cfg.create(make(a, 1, t0));
    expect(saved.id).toBeGreaterThan(0);
    const read = await cfg.getById(saved.id);
    expect(read).not.toBeNull();
    const expected = cfg.build(a, 1);
    for (const f of cfg.fields) {
      expect({ campo: f, valor: read![f] }).toEqual({ campo: f, valor: expected[f] });
    }
    expect(read!.evaluation.id).toBe(a.id);
    expect(sameDate((read as unknown as WithDates).completedAt, t0)).toBe(true);
    expect((read as unknown as WithDates).createdAt).toBeInstanceOf(Date);
  });

  it('getById de un id inexistente devuelve null, no lanza', async () => {
    expect(await cfg.getById(987654)).toBeNull();
  });

  it('getByEvaluation devuelve solo las filas de ESA evaluación', async () => {
    const { a, b } = evals();
    const ra = await cfg.create(make(a, 2, t0));
    const rb = await cfg.create(make(b, 3, t1));
    const listA = await cfg.getByEvaluation(a.id);
    const listB = await cfg.getByEvaluation(b.id);
    expect(listA.map(r => r.id)).toContain(ra.id);
    expect(listA.map(r => r.id)).not.toContain(rb.id);
    expect(listA.every(r => r.evaluation.id === a.id)).toBe(true);
    expect(listB.map(r => r.id)).toContain(rb.id);
    expect(listB.map(r => r.id)).not.toContain(ra.id);
    expect(listB.every(r => r.evaluation.id === b.id)).toBe(true);
  });

  it('getByEvaluation de una evaluación sin filas devuelve []', async () => {
    const empty = await makeEvaluation('vacia');
    expect(await cfg.getByEvaluation(empty.id)).toEqual([]);
  });

  it('getByEvaluation ordena por completedAt descendente', async () => {
    const ev = await makeEvaluation('orden');
    const older = await cfg.create(make(ev, 4, t0));
    const newer = await cfg.create(make(ev, 5, t1));
    const ids = (await cfg.getByEvaluation(ev.id)).map(r => r.id);
    expect(ids).toEqual([newer.id, older.id]);
  });

  if (cfg.update) {
    const update = cfg.update;
    it('update persiste el cambio sin crear una fila nueva', async () => {
      const ev = await makeEvaluation('upd');
      const saved = await cfg.create(make(ev, 6, t0));
      cfg.mutate(saved);
      await update(saved);
      const read = await cfg.getById(saved.id);
      expect(read!.id).toBe(saved.id);
      expect(await cfg.getByEvaluation(ev.id)).toHaveLength(1);
      const expected = cfg.build(ev, 6);
      cfg.mutate(expected);
      expect(read![cfg.mutatedField]).toEqual(expected[cfg.mutatedField]);
    });
  }

  if (cfg.remove) {
    const remove = cfg.remove;
    it('delete borra la fila y solo esa', async () => {
      const ev = await makeEvaluation('del');
      const keep = await cfg.create(make(ev, 7, t0));
      const drop = await cfg.create(make(ev, 8, t1));
      await remove(drop.id);
      expect(await cfg.getById(drop.id)).toBeNull();
      expect(await cfg.getById(keep.id)).not.toBeNull();
      expect((await cfg.getByEvaluation(ev.id)).map(r => r.id)).toEqual([keep.id]);
    });
  }
}
