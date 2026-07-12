import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL.
 *
 * El proyecto arranca con `synchronize: true` (ver `src/Database/config.ts`),
 * por lo que la tabla `executive_functions_test` se crea automáticamente al
 * registrar la entidad `ExecutiveFunctionsTest` en el array `entities`. Esta
 * migración solo es necesaria si en el futuro se desactiva `synchronize`.
 */
export class CreateExecutiveFunctions1718900000500 implements MigrationInterface {
  name = 'CreateExecutiveFunctions1718900000500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'executive_functions_test',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'instrument', type: 'varchar', default: "'Exploración lúdica de funciones ejecutivas'" },
          { name: 'ageBand', type: 'varchar', default: "'A'" },
          { name: 'results', type: 'text' }, // simple-json
          { name: 'attentionScore', type: 'integer', isNullable: true },
          { name: 'inhibitionScore', type: 'integer', isNullable: true },
          { name: 'flexibilityScore', type: 'integer', isNullable: true },
          { name: 'workingMemoryScore', type: 'integer', isNullable: true },
          { name: 'planningScore', type: 'integer', isNullable: true },
          { name: 'overallScore', type: 'integer', isNullable: true },
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
      'executive_functions_test',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('executive_functions_test');
  }
}
