import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL.
 *
 * Con `synchronize: true` (ver `src/Database/config.ts`) la tabla
 * `dysphagia_test` se crea automáticamente al registrar la entidad
 * `DysphagiaTest`. Esta migración es para entornos sin synchronize.
 */
export class CreateDysphagia1718900000250 implements MigrationInterface {
  name = 'CreateDysphagia1718900000250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'dysphagia_test',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'basalSpO2', type: 'integer', default: 98 },
          { name: 'spo2Source', type: 'varchar', default: "'manual'" },
          { name: 'bolus', type: 'text' }, // simple-json (BolusRecord[])
          { name: 'safetyAltered', type: 'boolean', default: 0 },
          { name: 'efficacyAltered', type: 'boolean', default: 0 },
          { name: 'minSpO2', type: 'integer', isNullable: true },
          { name: 'maxDrop', type: 'integer', isNullable: true },
          { name: 'recommendation', type: 'varchar', default: "''" },
          { name: 'verdict', type: 'varchar', default: "'safe'" },
          { name: 'interpretation', type: 'varchar', default: "''" },
          { name: 'notes', type: 'varchar', default: "''" },
          { name: 'evaluatorName', type: 'varchar', default: "''" },
          { name: 'evaluatorLicense', type: 'varchar', default: "''" },
          { name: 'completedAt', type: 'datetime' },
          { name: 'evaluationId', type: 'integer', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'dysphagia_test',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('dysphagia_test');
  }
}
