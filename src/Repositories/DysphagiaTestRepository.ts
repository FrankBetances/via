import { DysphagiaTest } from '@/Models/DysphagiaTest/DysphagiaTest';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del test de disfagia MECV-V (singleton), mismo patrón que
 * `AudiometryRepository` / `ScreeningRepository`.
 */
export class DysphagiaTestRepository {
  private static instance: DysphagiaTestRepository | null = null;
  private repository: Repository<DysphagiaTest> | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): DysphagiaTestRepository {
    if (!this.instance) this.instance = new DysphagiaTestRepository();
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) return;
    this.repository = AppDataSource.getRepository(DysphagiaTest);
    this.isInitialized = true;
  }

  private async getRepository(): Promise<Repository<DysphagiaTest>> {
    if (!this.isInitialized || !this.repository) await this.initialize();
    if (!this.repository) throw new Error('DysphagiaTestRepository: repository could not be initialized.');
    return this.repository;
  }

  static async createDysphagia(item: DysphagiaTest): Promise<DysphagiaTest> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async updateDysphagia(item: DysphagiaTest): Promise<DysphagiaTest> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async getDysphagiaById(id: number): Promise<DysphagiaTest | null> {
    const repo = await this.getInstance().getRepository();
    return repo.findOne({ where: { id }, relations: { evaluation: true } });
  }

  static async getDysphagiaByEvaluation(evaluationId: number): Promise<DysphagiaTest[]> {
    const repo = await this.getInstance().getRepository();
    return repo.find({
      where: { evaluation: { id: evaluationId } },
      relations: { evaluation: true },
      order: { completedAt: 'DESC' },
    });
  }

  static async deleteDysphagia(id: number): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.delete(id);
  }

  static async deleteAllDysphagias(): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.clear();
  }
}
