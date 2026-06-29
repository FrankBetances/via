import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL.
 *
 * El proyecto arranca con `synchronize: true` (ver `src/Database/config.ts`),
 * por lo que la tabla `screening` se crea automáticamente al registrar la
 * entidad `Screening` en el array `entities`. Esta migración solo es necesaria
 * si en el futuro se desactiva `synchronize` y se pasa a migraciones explícitas.
 *
 * Registro (cuando se use): añadir esta clase a `migrations: []` en
 * `src/Database/config.ts` y poner `synchronize: false`.
 */
export class CreateScreening1718900000000 implements MigrationInterface {
  name = 'CreateScreening1718900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'screening',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'instrument', type: 'varchar' },
          { name: 'score', type: 'integer' },
          { name: 'total', type: 'integer', default: 20 },
          { name: 'riskLevel', type: 'varchar' },
          { name: 'rangeLabel', type: 'varchar' },
          { name: 'recommendation', type: 'varchar' },
          { name: 'answers', type: 'text' }, // simple-json
          { name: 'blockCounts', type: 'text' }, // simple-json
          { name: 'flaggedItems', type: 'text' }, // simple-json
          { name: 'evaluatorName', type: 'varchar' },
          { name: 'evaluatorLicense', type: 'varchar' },
          { name: 'completedAt', type: 'datetime' },
          { name: 'evaluationId', type: 'integer', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'screening',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('screening');
  }
}
