import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del Test de Articulación a la Repetición (singleton), siguiendo el
 * mismo patrón que `SahsScreeningRepository` / `DysphagiaTestRepository`.
 * Métodos en forma corta ('Articulation', sin 'Test'), como acordó el contrato v3.
 */
export class ArticulationTestRepository {
  private static instance: ArticulationTestRepository | null = null;
  private repository: Repository<ArticulationTest> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): ArticulationTestRepository {
    if (!this.instance) {
      this.instance = new ArticulationTestRepository();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) {
      return;
    }
    try {
      this.repository = AppDataSource.getRepository(ArticulationTest);
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  private async getRepository(): Promise<Repository<ArticulationTest>> {
    if (!this.isInitialized || !this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('ArticulationTestRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createArticulation(test: ArticulationTest): Promise<ArticulationTest> {
    const instance: ArticulationTestRepository = this.getInstance();
    try {
      const repository: Repository<ArticulationTest> = await instance.getRepository();
      return await repository.save(test);
    } catch (error) {
      throw error;
    }
  }

  static async updateArticulation(test: ArticulationTest): Promise<ArticulationTest> {
    const instance: ArticulationTestRepository = this.getInstance();
    try {
      const repository: Repository<ArticulationTest> = await instance.getRepository();
      return await repository.save(test);
    } catch (error) {
      throw error;
    }
  }

  static async getArticulationById(id: number): Promise<ArticulationTest | null> {
    const instance: ArticulationTestRepository = this.getInstance();
    try {
      const repository: Repository<ArticulationTest> = await instance.getRepository();
      return await repository.findOne({
        where: { id },
        relations: ['evaluation'],
      });
    } catch (error) {
      throw error;
    }
  }

  static async getArticulationByEvaluation(evaluationId: number): Promise<ArticulationTest[]> {
    const instance: ArticulationTestRepository = this.getInstance();
    try {
      const repository: Repository<ArticulationTest> = await instance.getRepository();
      return await repository.find({
        where: { evaluation: { id: evaluationId } as any },
        relations: ['evaluation'],
        order: { completedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async deleteArticulation(id: number): Promise<void> {
    const instance: ArticulationTestRepository = this.getInstance();
    try {
      const repository: Repository<ArticulationTest> = await instance.getRepository();
      await repository.delete(id);
    } catch (error) {
      throw error;
    }
  }

  static async deleteAllArticulations(): Promise<void> {
    const instance: ArticulationTestRepository = this.getInstance();
    try {
      const repository: Repository<ArticulationTest> = await instance.getRepository();
      await repository.clear();
    } catch (error) {
      throw error;
    }
  }
}
