import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL.
 *
 * El proyecto arranca con `synchronize: true` (ver `src/Database/config.ts`),
 * por lo que la tabla `sahs_screening` se crea automáticamente al registrar la
 * entidad `SahsScreening` en el array `entities`. Esta migración solo es
 * necesaria si en el futuro se desactiva `synchronize` y se pasa a migraciones
 * explícitas.
 *
 * Registro (cuando se use): añadir esta clase a `migrations: []` en
 * `src/Database/config.ts` y poner `synchronize: false`.
 */
export class CreateSahsScreening1718900000300 implements MigrationInterface {
  name = 'CreateSahsScreening1718900000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sahs_screening',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'instrument', type: 'varchar', default: "'PSQ-Chervin / SAHS'" },
          { name: 'psqAnswers', type: 'text' }, // simple-json
          { name: 'psqYesCount', type: 'integer', default: 0 },
          { name: 'psqTotal', type: 'integer', default: 22 },
          { name: 'psqPositive', type: 'boolean', default: false },
          { name: 'redFlag', type: 'boolean', default: false },
          { name: 'brodsky', type: 'integer', isNullable: true },
          { name: 'imc', type: 'varchar', isNullable: true },
          { name: 'signs', type: 'text' }, // simple-json
          { name: 'riskFactors', type: 'text' }, // simple-json
          { name: 'breakdown', type: 'text' }, // simple-json
          { name: 'totalScore', type: 'integer', default: 0 },
          { name: 'scoreMax', type: 'integer', default: 13 },
          { name: 'suspicionLevel', type: 'varchar' },
          { name: 'suspicionLabel', type: 'varchar', default: "''" },
          { name: 'recommendation', type: 'varchar', default: "''" },
          { name: 'referral', type: 'varchar', default: "''" },
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
      'sahs_screening',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sahs_screening');
  }
}
