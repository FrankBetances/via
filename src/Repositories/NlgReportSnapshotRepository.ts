import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';
import { NlgReportSnapshot } from '@/Models/NlgReportSnapshot/NlgReportSnapshot';

/**
 * Instantáneas de la síntesis firmada. Solo INSERT y lectura: una fila
 * archivada no se reescribe (ver el modelo).
 */
export class NlgReportSnapshotRepository {
  private static repository: Repository<NlgReportSnapshot> | null = null;

  private static getRepository(): Repository<NlgReportSnapshot> {
    if (!this.repository) this.repository = AppDataSource.getRepository(NlgReportSnapshot);
    return this.repository;
  }

  static async insertSnapshot(snapshot: NlgReportSnapshot): Promise<NlgReportSnapshot> {
    // INSERT de una sola fila: sin BEGIN/COMMIT (ver Helpers/dbWrite.ts).
    return await this.getRepository().save(snapshot, { transaction: false });
  }

  static async getSnapshotsByEvaluation(evaluationId: number): Promise<NlgReportSnapshot[]> {
    return await this.getRepository().find({ where: { evaluationId }, order: { id: 'ASC' } });
  }
}
