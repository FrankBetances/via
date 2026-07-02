import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio del Certificado de Aptitud para la Prueba (singleton), siguiendo el
 * mismo patrón que `ScreeningRepository` / `EvaluationRepository`.
 */
export class ClinicalAssessmentRepository {
  private static instance: ClinicalAssessmentRepository | null = null;
  private repository: Repository<ClinicalAssessment> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): ClinicalAssessmentRepository {
    if (!this.instance) {
      this.instance = new ClinicalAssessmentRepository();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) {
      return;
    }
    try {
      this.repository = AppDataSource.getRepository(ClinicalAssessment);
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  private async getRepository(): Promise<Repository<ClinicalAssessment>> {
    if (!this.isInitialized || !this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('ClinicalAssessmentRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createClinicalAssessment(assessment: ClinicalAssessment): Promise<ClinicalAssessment> {
    const instance: ClinicalAssessmentRepository = this.getInstance();
    try {
      const repository: Repository<ClinicalAssessment> = await instance.getRepository();
      // INSERT de una sola fila: sin BEGIN/COMMIT (ver Helpers/dbWrite.ts).
      return await repository.save(assessment, { transaction: false });
    } catch (error) {
      throw error;
    }
  }

  static async updateClinicalAssessment(assessment: ClinicalAssessment): Promise<ClinicalAssessment> {
    const instance: ClinicalAssessmentRepository = this.getInstance();
    try {
      const repository: Repository<ClinicalAssessment> = await instance.getRepository();
      return await repository.save(assessment);
    } catch (error) {
      throw error;
    }
  }

  static async getClinicalAssessmentById(id: number): Promise<ClinicalAssessment | null> {
    const instance: ClinicalAssessmentRepository = this.getInstance();
    try {
      const repository: Repository<ClinicalAssessment> = await instance.getRepository();
      return await repository.findOne({
        where: { id },
        relations: ['evaluation'],
      });
    } catch (error) {
      throw error;
    }
  }

  static async getClinicalAssessmentsByEvaluation(evaluationId: number): Promise<ClinicalAssessment[]> {
    const instance: ClinicalAssessmentRepository = this.getInstance();
    try {
      const repository: Repository<ClinicalAssessment> = await instance.getRepository();
      return await repository.find({
        where: { evaluation: { id: evaluationId } as any },
        relations: ['evaluation'],
        order: { completedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async getLatestByEvaluation(evaluationId: number): Promise<ClinicalAssessment | null> {
    const instance: ClinicalAssessmentRepository = this.getInstance();
    try {
      const repository: Repository<ClinicalAssessment> = await instance.getRepository();
      return await repository.findOne({
        where: { evaluation: { id: evaluationId } as any },
        relations: ['evaluation'],
        order: { completedAt: 'DESC' },
      });
    } catch (error) {
      throw error;
    }
  }

  static async deleteClinicalAssessment(id: number): Promise<void> {
    const instance: ClinicalAssessmentRepository = this.getInstance();
    try {
      const repository: Repository<ClinicalAssessment> = await instance.getRepository();
      await repository.delete(id);
    } catch (error) {
      throw error;
    }
  }
}
