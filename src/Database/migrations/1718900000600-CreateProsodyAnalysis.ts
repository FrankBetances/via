import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL del análisis prosódico.
 *
 * El proyecto arranca con `synchronize: true` (ver `src/Database/config.ts`), por
 * lo que la tabla `prosody_analysis` se crea automáticamente al registrar la
 * entidad `ProsodyAnalysis` en el array `entities`. Esta migración solo es
 * necesaria si en el futuro se desactiva `synchronize`.
 *
 * Timestamp 1718900000600: posterior a ExecutiveFunctions (…500), sin colisión.
 */
export class CreateProsodyAnalysis1718900000600 implements MigrationInterface {
  name = 'CreateProsodyAnalysis1718900000600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'prosody_analysis',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          // Tarea y banda de edad: sin ellas, las métricas no son comparables
          // entre tomas (la tasa de habla depende fuertemente de la tarea).
          { name: 'task', type: 'varchar', default: "'narracion-lamina'" },
          { name: 'ageBand', type: 'varchar', default: "'prelector'" },
          { name: 'stimulusId', type: 'varchar', default: "''" },
          { name: 'language', type: 'varchar', default: "'es'" },
          { name: 'metrics', type: 'text' }, // simple-json
          { name: 'reason', type: 'varchar', default: "'ok'" },
          { name: 'interpretation', type: 'varchar', default: "''" },
          { name: 'notes', type: 'text' }, // simple-json
          { name: 'evaluatorName', type: 'varchar', default: "''" },
          { name: 'evaluatorLicense', type: 'varchar', default: "''" },
          { name: 'evaluatorSignatureSvg', type: 'text', isNullable: true },
          { name: 'completedAt', type: 'datetime' },
          { name: 'evaluationId', type: 'integer', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'prosody_analysis',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('prosody_analysis');
  }
}
