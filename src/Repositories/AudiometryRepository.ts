import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio de la audiometría tonal (singleton), mismo patrón que
 * `ScreeningRepository` / `GameTestRepository`. Compartido por las dos
 * pantallas (infantil y condicionada/tren) mediante la columna `method`.
 */
export class AudiometryRepository {
  private static instance: AudiometryRepository | null = null;
  private repository: Repository<AudiometryTest> | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): AudiometryRepository {
    if (!this.instance) this.instance = new AudiometryRepository();
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) return;
    this.repository = AppDataSource.getRepository(AudiometryTest);
    this.isInitialized = true;
  }

  private async getRepository(): Promise<Repository<AudiometryTest>> {
    if (!this.isInitialized || !this.repository) await this.initialize();
    if (!this.repository) throw new Error('AudiometryRepository: repository could not be initialized.');
    return this.repository;
  }

  static async createAudiometry(item: AudiometryTest): Promise<AudiometryTest> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async updateAudiometry(item: AudiometryTest): Promise<AudiometryTest> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async getAudiometryById(id: number): Promise<AudiometryTest | null> {
    const repo = await this.getInstance().getRepository();
    return repo.findOne({ where: { id }, relations: ['evaluation'] });
  }

  static async getAudiometryByEvaluation(evaluationId: number): Promise<AudiometryTest[]> {
    const repo = await this.getInstance().getRepository();
    return repo.find({
      where: { evaluation: { id: evaluationId } as any },
      relations: ['evaluation'],
      order: { completedAt: 'DESC' },
    });
  }

  static async deleteAudiometry(id: number): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.delete(id);
  }

  static async deleteAllAudiometries(): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.clear();
  }
}
