/* Ida y vuelta de InformedConsent, Professional y NlgReportSnapshot sobre sql.js (NO el driver nitro del dispositivo). */
jest.mock('@/Database/config', () =>
  require('../../../jest/memoryDataSource').configMock(),
);

import { AppDataSource } from '@/Database/config';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { InformedConsent } from '@/Models/InformedConsent/InformedConsent';
import { Professional } from '@/Models/Professional/Professional';
import { NlgReportSnapshot } from '@/Models/NlgReportSnapshot/NlgReportSnapshot';
import { InformedConsentRepository } from '@/Repositories/InformedConsentRepository';
import { ProfessionalRepository } from '@/Repositories/ProfessionalRepository';
import { NlgReportSnapshotRepository } from '@/Repositories/NlgReportSnapshotRepository';
import { makeEvaluation } from '../../../jest/repositoryFixtures';

beforeAll(async () => {
  await AppDataSource.initialize();
});

afterAll(async () => {
  await AppDataSource.destroy();
});

const buildConsent = (ev: Evaluation, signedAt: Date, name = 'Ana Pérez'): InformedConsent =>
  Object.assign(new InformedConsent(), {
    consentVersion: '1.0',
    signerType: 'guardian',
    signerName: name,
    signerRelation: 'madre',
    incapacityReason: null,
    patientIsMinor: true,
    signatureSvg: '<svg><path d="M0 0L5 5"/></svg>',
    signedAt,
    evaluation: ev,
  });

describe('InformedConsentRepository', () => {
  it('guarda y lee el último consentimiento con los mismos datos y la fecha de firma', async () => {
    const ev = await makeEvaluation('conRT');
    const signedAt = new Date('2026-11-10T09:15:30.123Z');
    const saved = await InformedConsentRepository.createInformedConsent(buildConsent(ev, signedAt));
    expect(saved.id).toBeGreaterThan(0);
    const read = await InformedConsentRepository.getLatestByEvaluation(ev.id);
    expect(read!.id).toBe(saved.id);
    expect(read!.consentVersion).toBe('1.0');
    expect(read!.signerType).toBe('guardian');
    expect(read!.signerName).toBe('Ana Pérez');
    expect(read!.signerRelation).toBe('madre');
    expect(read!.incapacityReason).toBeNull();
    expect(read!.patientIsMinor).toBe(true);
    expect(read!.signatureSvg).toBe('<svg><path d="M0 0L5 5"/></svg>');
    expect(new Date(read!.signedAt).getTime()).toBe(signedAt.getTime());
    expect(read!.evaluation.id).toBe(ev.id);
  });

  it('getLatestByEvaluation toma la firma más reciente de ESA evaluación y null si no hay', async () => {
    const ev = await makeEvaluation('conLatest');
    const other = await makeEvaluation('conLatestOther');
    await InformedConsentRepository.createInformedConsent(buildConsent(ev, new Date('2026-11-01T10:00:00.000Z'), 'vieja'));
    const newest = await InformedConsentRepository.createInformedConsent(buildConsent(ev, new Date('2026-11-05T10:00:00.000Z'), 'nueva'));
    await InformedConsentRepository.createInformedConsent(buildConsent(other, new Date('2026-11-30T10:00:00.000Z'), 'ajena'));
    const got = await InformedConsentRepository.getLatestByEvaluation(ev.id);
    expect(got!.id).toBe(newest.id);
    expect(got!.signerName).toBe('nueva');
    const none = await makeEvaluation('conNone');
    expect(await InformedConsentRepository.getLatestByEvaluation(none.id)).toBeNull();
  });

  it('un consentimiento sin firma (signatureSvg null, incapacityReason con texto) conserva ambos', async () => {
    const ev = await makeEvaluation('conNull');
    const c = buildConsent(ev, new Date());
    c.signatureSvg = null;
    c.incapacityReason = 'paciente no puede firmar';
    c.patientIsMinor = false;
    await InformedConsentRepository.createInformedConsent(c);
    const read = await InformedConsentRepository.getLatestByEvaluation(ev.id);
    expect(read!.signatureSvg).toBeNull();
    expect(read!.incapacityReason).toBe('paciente no puede firmar');
    expect(read!.patientIsMinor).toBe(false);
  });

  it('delete borra solo ese consentimiento', async () => {
    const ev = await makeEvaluation('conDel');
    const keep = await InformedConsentRepository.createInformedConsent(buildConsent(ev, new Date('2026-11-01T10:00:00.000Z')));
    const drop = await InformedConsentRepository.createInformedConsent(buildConsent(ev, new Date('2026-11-02T10:00:00.000Z')));
    await InformedConsentRepository.deleteInformedConsent(drop.id);
    const got = await InformedConsentRepository.getLatestByEvaluation(ev.id);
    expect(got!.id).toBe(keep.id);
  });
});

const buildPro = (n: string, extra: Partial<Professional> = {}): Professional =>
  Object.assign(new Professional(), {
    fullName: n,
    licenseNumber: `LIC-${n}`,
    role: 'logopeda',
    email: `${n.toLowerCase().replace(/\s/g, '')}@example.org`,
    passwordHash: 'pbkdf2$10000$sal$hash',
    centerId: 7,
    ...extra,
  });

describe('ProfessionalRepository', () => {
  it('guarda y lee por id, licencia y correo con los mismos datos', async () => {
    const saved = await ProfessionalRepository.createProfessional(buildPro('Rosa Vidal'));
    expect(saved.id).toBeGreaterThan(0);
    const byId = await ProfessionalRepository.getProfessionalById(saved.id);
    expect(byId).toMatchObject({
      fullName: 'Rosa Vidal',
      licenseNumber: 'LIC-Rosa Vidal',
      role: 'logopeda',
      email: 'rosavidal@example.org',
      passwordHash: 'pbkdf2$10000$sal$hash',
      centerId: 7,
    });
    expect(byId!.createdAt).toBeInstanceOf(Date);
    expect(byId!.name).toBe('Rosa Vidal');
    expect((await ProfessionalRepository.getProfessionalByLicense('LIC-Rosa Vidal'))!.id).toBe(saved.id);
    expect((await ProfessionalRepository.getProfessionalByEmail('rosavidal@example.org'))!.id).toBe(saved.id);
  });

  it('las búsquedas sin coincidencia devuelven null', async () => {
    expect(await ProfessionalRepository.getProfessionalById(987654)).toBeNull();
    expect(await ProfessionalRepository.getProfessionalByLicense('NO-EXISTE')).toBeNull();
    expect(await ProfessionalRepository.getProfessionalByEmail('no@existe.org')).toBeNull();
    expect(await ProfessionalRepository.getLatestByFullName('Nadie')).toBeNull();
  });

  it('correo y centro null vuelven null', async () => {
    const saved = await ProfessionalRepository.createProfessional(
      buildPro('Sin Correo', { email: null, centerId: null }),
    );
    const read = await ProfessionalRepository.getProfessionalById(saved.id);
    expect(read!.email).toBeNull();
    expect(read!.centerId).toBeNull();
  });

  it('update persiste (p. ej. la contraseña creada en el primer acceso) sin duplicar', async () => {
    const saved = await ProfessionalRepository.createProfessional(buildPro('Perfil Antiguo', { passwordHash: '' }));
    saved.passwordHash = 'pbkdf2$10000$nueva$hash';
    await ProfessionalRepository.updateProfessional(saved);
    const read = await ProfessionalRepository.getProfessionalById(saved.id);
    expect(read!.passwordHash).toBe('pbkdf2$10000$nueva$hash');
    const all = await ProfessionalRepository.getAllProfessionals();
    expect(all.filter(p => p.fullName === 'Perfil Antiguo')).toHaveLength(1);
  });

  it('getLatestByFullName devuelve el último alta con ese nombre exacto', async () => {
    await ProfessionalRepository.createProfessional(buildPro('Repetida', { licenseNumber: 'R1', email: 'r1@example.org' }));
    const second = await ProfessionalRepository.createProfessional(buildPro('Repetida', { licenseNumber: 'R2', email: 'r2@example.org' }));
    const got = await ProfessionalRepository.getLatestByFullName('Repetida');
    expect(got!.id).toBe(second.id);
    expect(got!.licenseNumber).toBe('R2');
  });

  it('getAllProfessionals lista todos y delete quita solo el indicado', async () => {
    const x = await ProfessionalRepository.createProfessional(buildPro('Borrar Uno', { email: 'b1@example.org' }));
    const y = await ProfessionalRepository.createProfessional(buildPro('Borrar Dos', { email: 'b2@example.org' }));
    const before = await ProfessionalRepository.getAllProfessionals();
    expect(before.map(p => p.id)).toEqual(expect.arrayContaining([x.id, y.id]));
    await ProfessionalRepository.deleteProfessional(x.id);
    expect(await ProfessionalRepository.getProfessionalById(x.id)).toBeNull();
    expect(await ProfessionalRepository.getProfessionalById(y.id)).not.toBeNull();
  });
});

const buildSnapshot = (evaluationId: number, text: string): NlgReportSnapshot =>
  Object.assign(new NlgReportSnapshot(), {
    evaluationId,
    evidenceVersion: 'v1',
    lang: 'es',
    status: 'ok',
    ruleIds: ['AUD-01', 'VOZ-02'],
    facts: [
      { ruleId: 'AUD-01', level: 'info', text: 'PTA ≤ 20 dB HL', measured: { pta: 15, n: null, ok: true, tag: 'x' } },
    ],
    formattedReportText: text,
    clinicianNotes: 'notas',
    clinicianSignatureSvg: null,
    professionalName: 'Dra. Prueba',
    professionalLicense: 'COL-123',
  });

describe('NlgReportSnapshotRepository', () => {
  it('inserta y lee la instantánea con listas/hechos anidados y caracteres fuera de ASCII intactos', async () => {
    const ev = await makeEvaluation('nlgRT');
    const saved = await NlgReportSnapshotRepository.insertSnapshot(buildSnapshot(ev.id, 'Texto ≥ 65/100 — niño'));
    expect(saved.id).toBeGreaterThan(0);
    const [read] = await NlgReportSnapshotRepository.getSnapshotsByEvaluation(ev.id);
    expect(read.id).toBe(saved.id);
    expect(read.evaluationId).toBe(ev.id);
    expect(read.ruleIds).toEqual(['AUD-01', 'VOZ-02']);
    expect(read.facts).toEqual(buildSnapshot(ev.id, '').facts);
    expect(read.facts[0].measured.n).toBeNull();
    expect(read.formattedReportText).toBe('Texto ≥ 65/100 — niño');
    expect(read.clinicianSignatureSvg).toBeNull();
    expect(read.status).toBe('ok');
    expect(read.createdAt).toBeInstanceOf(Date);
  });

  it('getSnapshotsByEvaluation filtra por evaluación y ordena por id ascendente', async () => {
    const e1 = await makeEvaluation('nlgX');
    const e2 = await makeEvaluation('nlgY');
    const s1 = await NlgReportSnapshotRepository.insertSnapshot(buildSnapshot(e1.id, 'uno'));
    const s2 = await NlgReportSnapshotRepository.insertSnapshot(buildSnapshot(e2.id, 'ajena'));
    const s3 = await NlgReportSnapshotRepository.insertSnapshot(buildSnapshot(e1.id, 'dos'));
    const l1 = await NlgReportSnapshotRepository.getSnapshotsByEvaluation(e1.id);
    expect(l1.map(s => s.id)).toEqual([s1.id, s3.id]);
    expect(l1.map(s => s.id)).not.toContain(s2.id);
    expect(await NlgReportSnapshotRepository.getSnapshotsByEvaluation(987654)).toEqual([]);
  });
});
