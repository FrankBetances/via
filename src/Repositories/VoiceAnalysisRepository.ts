import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del análisis acústico de voz (singleton), mismo patrón que
 * `ScreeningRepository` / `GameTestRepository`.
 */
export class VoiceAnalysisRepository {
  private static instance: VoiceAnalysisRepository | null = null;
  private repository: Repository<VoiceAnalysis> | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): VoiceAnalysisRepository {
    if (!this.instance) this.instance = new VoiceAnalysisRepository();
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) return;
    this.repository = AppDataSource.getRepository(VoiceAnalysis);
    this.isInitialized = true;
  }

  private async getRepository(): Promise<Repository<VoiceAnalysis>> {
    if (!this.isInitialized || !this.repository) await this.initialize();
    if (!this.repository) {
      throw new Error('VoiceAnalysisRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createVoiceAnalysis(item: VoiceAnalysis): Promise<VoiceAnalysis> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async updateVoiceAnalysis(item: VoiceAnalysis): Promise<VoiceAnalysis> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async getVoiceAnalysisById(id: number): Promise<VoiceAnalysis | null> {
    const repo = await this.getInstance().getRepository();
    return repo.findOne({ where: { id }, relations: { evaluation: true } });
  }

  static async getVoiceAnalysisByEvaluation(evaluationId: number): Promise<VoiceAnalysis[]> {
    const repo = await this.getInstance().getRepository();
    return repo.find({
      where: { evaluation: { id: evaluationId } },
      relations: { evaluation: true },
      order: { completedAt: 'DESC' },
    });
  }

  static async deleteVoiceAnalysis(id: number): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.delete(id);
  }

  static async deleteAllVoiceAnalyses(): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.clear();
  }
}
