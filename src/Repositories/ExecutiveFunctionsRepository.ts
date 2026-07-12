import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio de la exploración de funciones ejecutivas (singleton), mismo
 * patrón que `VerbalAudiometryRepository` / `ArticulationTestRepository`.
 */
export class ExecutiveFunctionsRepository {
  private static instance: ExecutiveFunctionsRepository | null = null;
  private repository: Repository<ExecutiveFunctionsTest> | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ExecutiveFunctionsRepository {
    if (!this.instance) this.instance = new ExecutiveFunctionsRepository();
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) return;
    this.repository = AppDataSource.getRepository(ExecutiveFunctionsTest);
    this.isInitialized = true;
  }

  private async getRepository(): Promise<Repository<ExecutiveFunctionsTest>> {
    if (!this.isInitialized || !this.repository) await this.initialize();
    if (!this.repository) throw new Error('ExecutiveFunctionsRepository: repository could not be initialized.');
    return this.repository;
  }

  static async createExecutiveFunctions(item: ExecutiveFunctionsTest): Promise<ExecutiveFunctionsTest> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async updateExecutiveFunctions(item: ExecutiveFunctionsTest): Promise<ExecutiveFunctionsTest> {
    const repo = await this.getInstance().getRepository();
    return repo.save(item);
  }

  static async getExecutiveFunctionsById(id: number): Promise<ExecutiveFunctionsTest | null> {
    const repo = await this.getInstance().getRepository();
    return repo.findOne({ where: { id }, relations: ['evaluation'] });
  }

  static async getExecutiveFunctionsByEvaluation(evaluationId: number): Promise<ExecutiveFunctionsTest[]> {
    const repo = await this.getInstance().getRepository();
    return repo.find({
      where: { evaluation: { id: evaluationId } as any },
      relations: ['evaluation'],
      order: { completedAt: 'DESC' },
    });
  }

  static async deleteExecutiveFunctions(id: number): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.delete(id);
  }

  static async deleteAllExecutiveFunctions(): Promise<void> {
    const repo = await this.getInstance().getRepository();
    await repo.clear();
  }
}
