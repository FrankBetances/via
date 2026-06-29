import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL del Test de Articulación a la Repetición (T.A.R.).
 *
 * El proyecto arranca con `synchronize: true` (ver `src/Database/config.ts`), por
 * lo que la tabla `articulation_test` se crea automáticamente al registrar la
 * entidad `ArticulationTest` en el array `entities`. Esta migración solo es
 * necesaria si en el futuro se desactiva `synchronize`.
 *
 * Timestamp 1718900000350: posterior a SahsScreening (…300), sin colisión.
 */
export class CreateArticulation1718900000350 implements MigrationInterface {
  name = 'CreateArticulation1718900000350';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'articulation_test',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'instrument', type: 'varchar', default: "'T.A.R. (Articulación a la Repetición)'" },
          { name: 'results', type: 'text' }, // simple-json
          { name: 'substitutions', type: 'text' }, // simple-json
          { name: 'evaluatedCount', type: 'integer', default: 0 },
          { name: 'totalCount', type: 'integer', default: 0 },
          { name: 'correctPct', type: 'integer', default: 0 },
          { name: 'sodaCounts', type: 'text' }, // simple-json
          { name: 'affectedPhonemes', type: 'text' }, // simple-json
          { name: 'phonemeStatus', type: 'text' }, // simple-json
          { name: 'notes', type: 'text' }, // simple-json
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
      'articulation_test',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('articulation_test');
  }
}
