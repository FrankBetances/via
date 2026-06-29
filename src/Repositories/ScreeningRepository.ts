import { Screening } from '@/Models/Screening/Screening';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del cribado (singleton), siguiendo el mismo patrón que
 * `EvaluationRepository` / `GameTestRepository`.
 */
export class ScreeningRepository {
  private static instance: ScreeningRepository | null = null;
  private repository: Repository<Screening> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): ScreeningRepository {
    if (!this.instance) {
      this.instance = new ScreeningRepository();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) {
      return;
    }
    try {
      this.repository = AppDataSource.getRepository(Screening);
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  private async getRepository(): Promise<Repository<Screening>> {
    if (!this.isInitialized || !this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('ScreeningRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createScreening(screening: Screening): Promise<Screening> {
    const instance: ScreeningRepository = this.getInstance();
    try {
      const repository: Repository<Screening> = await instance.getRepository();
      return await repository.save(screening);
    } catch (error) {
      throw error;
    }
  }

  static async updateScreening(screening: Screening): Promise<Screening> {
    const instance: ScreeningRepository = this.getInstance();
    try {
      const repository: Repository<Screening> = await instance.getRepository();
      return await repository.save(screening);
    } catch (error) {
      throw error;
    }
  }

  static async getScreeningById(id: number): Promise<Screening | null> {
    const instance: ScreeningRepository = this.getInstance();
    try {
      const repository: Repository<Screening> = await instance.getRepository();
      return await repository.findOne({
        where: { id },
        relations: ['evaluation'],
      });
    } catch (error) {
      throw error;
    }
  }

  static async getScreeningsByEvaluation(evaluationId: number): Promise<Screening[]> {
    const instance: ScreeningRepository = this.getInstance();
    try {
      const repository: Repository<Screening> = await instance.getRepository();
      return await repository.find({
        where: { evaluation: { id: evaluationId } as any },
        relations: ['evaluation'],
        order: { completedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async getLatestByEvaluationAndInstrument(
    evaluationId: number,
    instrument: string,
  ): Promise<Screening | null> {
    const instance: ScreeningRepository = this.getInstance();
    try {
      const repository: Repository<Screening> = await instance.getRepository();
      return await repository.findOne({
        where: { evaluation: { id: evaluationId } as any, instrument },
        relations: ['evaluation'],
        order: { completedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async deleteScreening(id: number): Promise<void> {
    const instance: ScreeningRepository = this.getInstance();
    try {
      const repository: Repository<Screening> = await instance.getRepository();
      await repository.delete(id);
    } catch (error) {
      throw error;
    }
  }

  static async deleteAllScreenings(): Promise<void> {
    const instance: ScreeningRepository = this.getInstance();
    try {
      const repository: Repository<Screening> = await instance.getRepository();
      await repository.clear();
    } catch (error) {
      throw error;
    }
  }
}
