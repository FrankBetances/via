import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio de la audiometría verbal en campo libre (singleton), mismo
 * patrón que `AudiometryRepository` / `ArticulationTestRepository`.
 */
export class VerbalAudiometryRepository {
  private static instance: VerbalAudiometryRepository | null = null;
  private repository: Repository<VerbalAudiometryTest> | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): VerbalAudiometryRepository {
    if (!this.instance) this.instance = new VerbalAudiometryRepository();
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) return;
    this.repository = AppDataSource.getRepository(VerbalAudiometryTest);
    this.isInitialized = true;
  }

  private async getRepository(): Promise<Repository<VerbalAudiometryTest>> {
    if (!this.isInitialized || !this.repository) await this.initialize();
    if (!this.repository) throw new Error('VerbalAudiometryRepository: repository could not be initialized.');
    return this.repository;
  }

  static async createVerbalAudiometry(item: VerbalAudiometryTest): Promise<VerbalAudiometryTest> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async updateVerbalAudiometry(item: VerbalAudiometryTest): Promise<VerbalAudiometryTest> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async getVerbalAudiometryById(id: number): Promise<VerbalAudiometryTest | null> {
    const repo = await this.getInstance().getRepository();
    return repo.findOne({ where: { id }, relations: ['evaluation'] });
  }

  static async getVerbalAudiometryByEvaluation(evaluationId: number): Promise<VerbalAudiometryTest[]> {
    const repo = await this.getInstance().getRepository();
    return repo.find({
      where: { evaluation: { id: evaluationId } as any },
      relations: ['evaluation'],
      order: { completedAt: 'DESC' },
    });
  }

  static async deleteVerbalAudiometry(id: number): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.delete(id);
  }

  static async deleteAllVerbalAudiometries(): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.clear();
  }
}
