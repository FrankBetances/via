/* Test de humo del banco de persistencia: repositorios REALES sobre SQLite en memoria. */
jest.mock('@/Database/config', () =>
  require('../../../jest/memoryDataSource').configMock(),
);

import { AppDataSource } from '@/Database/config';
import { ENTITIES } from '@/Database/entities';
import { Patient } from '@/Models/Patient/Patient';
import { Professional } from '@/Models/Professional/Professional';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { PatientRepository } from '@/Repositories/PatientRepository';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';

beforeAll(async () => {
  await AppDataSource.initialize();
});

afterAll(async () => {
  await AppDataSource.destroy();
});

describe('banco de persistencia en memoria (sql.js)', () => {
  it('registra TODAS las entidades de la base real', () => {
    expect(AppDataSource.entityMetadatas).toHaveLength(ENTITIES.length);
  });

  it('guarda y lee un Patient con el repositorio real', async () => {
    const p = new Patient();
    p.idHash = 'hash-nhc-001';
    p.nameEnc = 'Lucia Perez';
    p.dobEnc = '2019-05-04';
    p.sex = 'F';
    p.legalGuardianName = 'Ana Perez';
    p.centerId = null;

    const saved = await PatientRepository.createPatient(p);
    expect(saved.id).toBeGreaterThan(0);

    const byId = await PatientRepository.getPatientById(saved.id);
    expect(byId?.idHash).toBe('hash-nhc-001');
    expect(byId?.sex).toBe('F');
    expect(byId?.createdAt).toBeInstanceOf(Date);

    const byHash = await PatientRepository.getPatientByIdHash('hash-nhc-001');
    expect(byHash?.id).toBe(saved.id);
  });

  it('guarda y lee una Evaluation con paciente y profesional (eager) y fechas', async () => {
    const patient = new Patient();
    patient.idHash = 'hash-nhc-002';
    patient.nameEnc = 'Mario Gil';
    patient.dobEnc = '2018-01-01';
    const savedPatient = await PatientRepository.createPatient(patient);

    const pro = await AppDataSource.getRepository(Professional).save(
      Object.assign(new Professional(), { fullName: 'Dra. Prueba', role: 'logopeda' }),
    );

    const ev = new Evaluation();
    ev.patient = savedPatient;
    ev.professional = pro;
    ev.status = 'in_progress';
    ev.consentSignedAt = null;
    ev.capApproved = true;
    ev.capNotes = 'apto';
    ev.completedAt = null;
    const savedEv = await EvaluationRepository.createEvaluation(ev);

    const signedAt = new Date('2026-11-15T10:00:00.000Z');
    await EvaluationRepository.markConsentSigned(savedEv.id, signedAt);

    const read = await EvaluationRepository.getEvaluationById(savedEv.id);
    expect(read?.patient.idHash).toBe('hash-nhc-002');
    expect(read?.professional.fullName).toBe('Dra. Prueba');
    expect(read?.capApproved).toBe(true);
    expect(read?.capNotes).toBe('apto');
    expect(new Date(read!.consentSignedAt as Date).toISOString()).toBe(signedAt.toISOString());
  });
});
