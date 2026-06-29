import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio de Evaluaciones (singleton), siguiendo el mismo patrón que
 * `ClinicalAssessmentRepository` / `ScreeningRepository`. Ancla del flujo
 * Consentimiento -> CAP -> batería -> informe PDF (ver `Evaluation`).
 */
export class EvaluationRepository {
  private static instance: EvaluationRepository | null = null;
  private repository: Repository<Evaluation> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): EvaluationRepository {
    if (!this.instance) {
      this.instance = new EvaluationRepository();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) {
      return;
    }
    try {
      this.repository = AppDataSource.getRepository(Evaluation);
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  private async getRepository(): Promise<Repository<Evaluation>> {
    if (!this.isInitialized || !this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('EvaluationRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createEvaluation(evaluation: Evaluation): Promise<Evaluation> {
    const instance: EvaluationRepository = this.getInstance();
    try {
      const repository: Repository<Evaluation> = await instance.getRepository();
      return await repository.save(evaluation);
    } catch (error) {
      throw error;
    }
  }

  static async updateEvaluation(evaluation: Evaluation): Promise<Evaluation> {
    const instance: EvaluationRepository = this.getInstance();
    try {
      const repository: Repository<Evaluation> = await instance.getRepository();
      return await repository.save(evaluation);
    } catch (error) {
      throw error;
    }
  }

  static async getEvaluationById(id: number): Promise<Evaluation | null> {
    const instance: EvaluationRepository = this.getInstance();
    try {
      const repository: Repository<Evaluation> = await instance.getRepository();
      return await repository.findOne({
        where: { id },
        relations: { patient: true, professional: true },
      });
    } catch (error) {
      throw error;
    }
  }

  static async getEvaluationsByPatient(patientId: number): Promise<Evaluation[]> {
    const instance: EvaluationRepository = this.getInstance();
    try {
      const repository: Repository<Evaluation> = await instance.getRepository();
      return await repository.find({
        where: { patient: { id: patientId } },
        relations: { patient: true, professional: true },
        order: { startedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async getLatestPendingByPatient(patientId: number): Promise<Evaluation | null> {
    const instance: EvaluationRepository = this.getInstance();
    try {
      const repository: Repository<Evaluation> = await instance.getRepository();
      return await repository.findOne({
        where: { patient: { id: patientId }, status: 'in_progress' },
        relations: { patient: true, professional: true },
        order: { startedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async getAllEvaluations(): Promise<Evaluation[]> {
    const instance: EvaluationRepository = this.getInstance();
    try {
      const repository: Repository<Evaluation> = await instance.getRepository();
      return await repository.find({
        relations: { patient: true, professional: true },
        order: { startedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async deleteEvaluation(id: number): Promise<void> {
    const instance: EvaluationRepository = this.getInstance();
    try {
      const repository: Repository<Evaluation> = await instance.getRepository();
      await repository.delete(id);
    } catch (error) {
      throw error;
    }
  }
}
