import { Professional } from '@/Models/Professional/Professional';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio de Profesionales (singleton), siguiendo el mismo patrón que
 * `ClinicalAssessmentRepository` / `ScreeningRepository`.
 */
export class ProfessionalRepository {
  private static instance: ProfessionalRepository | null = null;
  private repository: Repository<Professional> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): ProfessionalRepository {
    if (!this.instance) {
      this.instance = new ProfessionalRepository();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) {
      return;
    }
    try {
      this.repository = AppDataSource.getRepository(Professional);
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  private async getRepository(): Promise<Repository<Professional>> {
    if (!this.isInitialized || !this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('ProfessionalRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createProfessional(professional: Professional): Promise<Professional> {
    const instance: ProfessionalRepository = this.getInstance();
    try {
      const repository: Repository<Professional> = await instance.getRepository();
      // `transaction: false`: es un INSERT de una sola fila (atómico por sí
      // mismo); evitar BEGIN/COMMIT reduce la superficie de fallo del driver
      // nitro-sqlite, donde se han observado promesas de save() que no
      // resuelven (ver Helpers/dbWrite.ts).
      return await repository.save(professional, { transaction: false });
    } catch (error) {
      throw error;
    }
  }

  /** Último profesional registrado con ese nombre exacto (verificación post-alta). */
  static async getLatestByFullName(fullName: string): Promise<Professional | null> {
    const instance: ProfessionalRepository = this.getInstance();
    try {
      const repository: Repository<Professional> = await instance.getRepository();
      return await repository.findOne({ where: { fullName }, order: { id: 'DESC' } });
    } catch (error) {
      throw error;
    }
  }

  static async updateProfessional(professional: Professional): Promise<Professional> {
    const instance: ProfessionalRepository = this.getInstance();
    try {
      const repository: Repository<Professional> = await instance.getRepository();
      return await repository.save(professional);
    } catch (error) {
      throw error;
    }
  }

  static async getProfessionalById(id: number): Promise<Professional | null> {
    const instance: ProfessionalRepository = this.getInstance();
    try {
      const repository: Repository<Professional> = await instance.getRepository();
      return await repository.findOne({ where: { id } });
    } catch (error) {
      throw error;
    }
  }

  static async getProfessionalByLicense(licenseNumber: string): Promise<Professional | null> {
    const instance: ProfessionalRepository = this.getInstance();
    try {
      const repository: Repository<Professional> = await instance.getRepository();
      return await repository.findOne({ where: { licenseNumber } });
    } catch (error) {
      throw error;
    }
  }

  static async getProfessionalByEmail(email: string): Promise<Professional | null> {
    const instance: ProfessionalRepository = this.getInstance();
    try {
      const repository: Repository<Professional> = await instance.getRepository();
      return await repository.findOne({ where: { email } });
    } catch (error) {
      throw error;
    }
  }

  static async getAllProfessionals(): Promise<Professional[]> {
    const instance: ProfessionalRepository = this.getInstance();
    try {
      const repository: Repository<Professional> = await instance.getRepository();
      return await repository.find({ order: { createdAt: 'DESC' } });
    } catch (error) {
      throw error;
    }
  }

  static async deleteProfessional(id: number): Promise<void> {
    const instance: ProfessionalRepository = this.getInstance();
    try {
      const repository: Repository<Professional> = await instance.getRepository();
      await repository.delete(id);
    } catch (error) {
      throw error;
    }
  }
}
