import { ProsodyAnalysis } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del análisis prosódico (singleton), mismo patrón que
 * `VoiceAnalysisRepository` / `ArticulationTestRepository`.
 */
export class ProsodyAnalysisRepository {
  private static instance: ProsodyAnalysisRepository | null = null;
  private repository: Repository<ProsodyAnalysis> | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ProsodyAnalysisRepository {
    if (!this.instance) this.instance = new ProsodyAnalysisRepository();
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) return;
    this.repository = AppDataSource.getRepository(ProsodyAnalysis);
    this.isInitialized = true;
  }

  private async getRepository(): Promise<Repository<ProsodyAnalysis>> {
    if (!this.isInitialized || !this.repository) await this.initialize();
    if (!this.repository) {
      throw new Error('ProsodyAnalysisRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createProsodyAnalysis(item: ProsodyAnalysis): Promise<ProsodyAnalysis> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async updateProsodyAnalysis(item: ProsodyAnalysis): Promise<ProsodyAnalysis> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async getProsodyAnalysisById(id: number): Promise<ProsodyAnalysis | null> {
    const repo = await this.getInstance().getRepository();
    return repo.findOne({ where: { id }, relations: ['evaluation'] });
  }

  static async getProsodyAnalysisByEvaluation(evaluationId: number): Promise<ProsodyAnalysis[]> {
    const repo = await this.getInstance().getRepository();
    return repo.find({
      where: { evaluation: { id: evaluationId } as any },
      relations: ['evaluation'],
      order: { completedAt: 'DESC' },
    });
  }

  static async deleteProsodyAnalysis(id: number): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.delete(id);
  }

  static async deleteAllProsodyAnalyses(): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.clear();
  }
}
