import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migración OPCIONAL.
 *
 * El proyecto arranca con `synchronize: true` (ver `src/Database/config.ts`),
 * por lo que la tabla `voice_analysis` se crea automáticamente al registrar la
 * entidad `VoiceAnalysis` en el array `entities`. Esta migración solo es
 * necesaria si en el futuro se desactiva `synchronize`.
 */
export class CreateVoiceAnalysis1718900000200 implements MigrationInterface {
  name = 'CreateVoiceAnalysis1718900000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'voice_analysis',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'vowel', type: 'varchar', default: "'a'" },
          { name: 'source', type: 'varchar', default: "'demo'" },
          { name: 'durationSec', type: 'float', default: 5 },
          { name: 'quality', type: 'varchar', default: "'med'" },
          // Acústica anulable: null = prueba cerrada manualmente (solo GRBAS).
          { name: 'f0', type: 'float', isNullable: true },
          { name: 'jitter', type: 'float', isNullable: true },
          { name: 'shimmer', type: 'float', isNullable: true },
          { name: 'hnr', type: 'float', isNullable: true },
          { name: 'formants', type: 'text', isNullable: true }, // simple-json
          { name: 'interpretation', type: 'varchar', default: "''" },
          { name: 'notes', type: 'varchar', default: "''" },
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
      'voice_analysis',
      new TableForeignKey({
        columnNames: ['evaluationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'evaluation',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('voice_analysis');
  }
}
