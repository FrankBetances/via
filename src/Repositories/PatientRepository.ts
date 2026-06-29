import { Patient } from '@/Models/Patient/Patient';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/Database/config';

/**
 * Repositorio de Pacientes (singleton), siguiendo el mismo patrón que
 * `ClinicalAssessmentRepository` / `ScreeningRepository`.
 */
export class PatientRepository {
  private static instance: PatientRepository | null = null;
  private repository: Repository<Patient> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): PatientRepository {
    if (!this.instance) {
      this.instance = new PatientRepository();
    }
    return this.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized && this.repository) {
      return;
    }
    try {
      this.repository = AppDataSource.getRepository(Patient);
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  private async getRepository(): Promise<Repository<Patient>> {
    if (!this.isInitialized || !this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('PatientRepository: repository could not be initialized.');
    }
    return this.repository;
  }

  static async createPatient(patient: Patient): Promise<Patient> {
    const instance: PatientRepository = this.getInstance();
    try {
      const repository: Repository<Patient> = await instance.getRepository();
      return await repository.save(patient);
    } catch (error) {
      throw error;
    }
  }

  static async updatePatient(patient: Patient): Promise<Patient> {
    const instance: PatientRepository = this.getInstance();
    try {
      const repository: Repository<Patient> = await instance.getRepository();
      return await repository.save(patient);
    } catch (error) {
      throw error;
    }
  }

  static async getPatientById(id: number): Promise<Patient | null> {
    const instance: PatientRepository = this.getInstance();
    try {
      const repository: Repository<Patient> = await instance.getRepository();
      return await repository.findOne({ where: { id } });
    } catch (error) {
      throw error;
    }
  }

  static async getPatientByIdHash(idHash: string): Promise<Patient | null> {
    const instance: PatientRepository = this.getInstance();
    try {
      const repository: Repository<Patient> = await instance.getRepository();
      return await repository.findOne({ where: { idHash } });
    } catch (error) {
      throw error;
    }
  }

  static async getAllPatients(): Promise<Patient[]> {
    const instance: PatientRepository = this.getInstance();
    try {
      const repository: Repository<Patient> = await instance.getRepository();
      return await repository.find({ order: { createdAt: 'DESC' } });
    } catch (error) {
      throw error;
    }
  }

  static async deletePatient(id: number): Promise<void> {
    const instance: PatientRepository = this.getInstance();
    try {
      const repository: Repository<Patient> = await instance.getRepository();
      await repository.delete(id);
    } catch (error) {
      throw error;
    }
  }
}
