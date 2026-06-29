import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del cribado de SAHS (singleton), siguiendo el mismo patrón que
 * `ScreeningRepository` / `DysphagiaTestRepository`.
 */
export class SahsScreeningRepository {
  private static instance: SahsScreeningRepository | null = null;
  private repository: Repository<SahsScreening> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): SahsScreeningRepository {
    if (!this.instance) {
      this.instance = new SahsScreeningRepository();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) {
      return;
    }
    try {
      this.repository = AppDataSource.getRepository(SahsScreening);
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  private async getRepository(): Promise<Repository<SahsScreening>> {
    if (!this.isInitialized || !this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('SahsScreeningRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createSahsScreening(screening: SahsScreening): Promise<SahsScreening> {
    const instance: SahsScreeningRepository = this.getInstance();
    try {
      const repository: Repository<SahsScreening> = await instance.getRepository();
      return await repository.save(screening);
    } catch (error) {
      throw error;
    }
  }

  static async updateSahsScreening(screening: SahsScreening): Promise<SahsScreening> {
    const instance: SahsScreeningRepository = this.getInstance();
    try {
      const repository: Repository<SahsScreening> = await instance.getRepository();
      return await repository.save(screening);
    } catch (error) {
      throw error;
    }
  }

  static async getSahsScreeningById(id: number): Promise<SahsScreening | null> {
    const instance: SahsScreeningRepository = this.getInstance();
    try {
      const repository: Repository<SahsScreening> = await instance.getRepository();
      return await repository.findOne({
        where: { id },
        relations: ['evaluation'],
      });
    } catch (error) {
      throw error;
    }
  }

  static async getSahsScreeningsByEvaluation(evaluationId: number): Promise<SahsScreening[]> {
    const instance: SahsScreeningRepository = this.getInstance();
    try {
      const repository: Repository<SahsScreening> = await instance.getRepository();
      return await repository.find({
        where: { evaluation: { id: evaluationId } as any },
        relations: ['evaluation'],
        order: { completedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async deleteSahsScreening(id: number): Promise<void> {
    const instance: SahsScreeningRepository = this.getInstance();
    try {
      const repository: Repository<SahsScreening> = await instance.getRepository();
      await repository.delete(id);
    } catch (error) {
      throw error;
    }
  }

  static async deleteAllSahsScreenings(): Promise<void> {
    const instance: SahsScreeningRepository = this.getInstance();
    try {
      const repository: Repository<SahsScreening> = await instance.getRepository();
      await repository.clear();
    } catch (error) {
      throw error;
    }
  }
}
