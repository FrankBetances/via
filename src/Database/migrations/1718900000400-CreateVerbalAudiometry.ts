import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL de la Audiometría Verbal en campo libre.
 *
 * El proyecto arranca con `synchronize: true` (ver `src/Database/config.ts`),
 * por lo que la tabla `verbal_audiometry_test` se crea automáticamente al
 * registrar la entidad `VerbalAudiometryTest` en el array `entities`. Esta
 * migración solo es necesaria si en el futuro se desactiva `synchronize`.
 *
 * Timestamp 1718900000400: posterior a Articulation (…350), sin colisión.
 */
export class CreateVerbalAudiometry1718900000400 implements MigrationInterface {
  name = 'CreateVerbalAudiometry1718900000400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'verbal_audiometry_test',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'instrument', type: 'varchar', default: "'Audiometría verbal (campo libre)'" },
          { name: 'transducer', type: 'varchar', default: "'soundfield'" },
          { name: 'ageBand', type: 'varchar', default: "'A'" },
          { name: 'language', type: 'varchar', default: "'es'" },
          { name: 'modality', type: 'varchar', default: "'images'" },
          { name: 'mode', type: 'varchar', default: "'discrimination'" },
          { name: 'results', type: 'text' }, // simple-json
          { name: 'levelScores', type: 'text' }, // simple-json
          { name: 'srtDb', type: 'integer', isNullable: true },
          { name: 'presentedCount', type: 'integer', default: 0 },
          { name: 'correctCount', type: 'integer', default: 0 },
          { name: 'discriminationPct', type: 'integer', default: 0 },
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
      'verbal_audiometry_test',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('verbal_audiometry_test');
  }
}
