import { InformedConsent } from '@/Models/InformedConsent/InformedConsent';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del consentimiento informado (singleton), mismo patrón que
 * `ClinicalAssessmentRepository` / `EvaluationRepository`.
 */
export class InformedConsentRepository {
  private static instance: InformedConsentRepository | null = null;
  private repository: Repository<InformedConsent> | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): InformedConsentRepository {
    if (!this.instance) this.instance = new InformedConsentRepository();
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) return;
    this.repository = AppDataSource.getRepository(InformedConsent);
    this.isInitialized = true;
  }

  private async getRepository(): Promise<Repository<InformedConsent>> {
    if (!this.isInitialized || !this.repository) await this.initialize();
    if (!this.repository) {
      throw new Error('InformedConsentRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createInformedConsent(item: InformedConsent): Promise<InformedConsent> {
    const repo = await this.getInstance().getRepository();
    // INSERT de una sola fila: sin BEGIN/COMMIT (ver Helpers/dbWrite.ts).
    return repo.save(item, { transaction: false });
  }

  static async getLatestByEvaluation(evaluationId: number): Promise<InformedConsent | null> {
    const repo = await this.getInstance().getRepository();
    return repo.findOne({
      where: { evaluation: { id: evaluationId } as any },
      relations: ['evaluation'],
      order: { signedAt: 'DESC' },
    });
  }

  static async deleteInformedConsent(id: number): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.delete(id);
  }
}
