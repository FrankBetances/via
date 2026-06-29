import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL.
 *
 * Con `synchronize: true` (ver `src/Database/config.ts`) la tabla
 * `audiometry_test` se crea automáticamente al registrar la entidad
 * `AudiometryTest`. Esta tabla es COMPARTIDA por las dos pantallas de
 * audiometría (infantil = `method: 'play'`, condicionada/tren = `method:
 * 'conditioned'`). Registre la entidad UNA sola vez.
 */
export class CreateAudiometry1718900000100 implements MigrationInterface {
  name = 'CreateAudiometry1718900000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audiometry_test',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'method', type: 'varchar', default: "'play'" },
          { name: 'transducer', type: 'varchar', default: "'air'" },
          { name: 'thresholds', type: 'text' }, // simple-json
          { name: 'ptaOD', type: 'integer', isNullable: true },
          { name: 'ptaOI', type: 'integer', isNullable: true },
          { name: 'reliability', type: 'integer', isNullable: true },
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
      'audiometry_test',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audiometry_test');
  }
}
