import { AshaMilestoneTest } from '@/Models/Asha/AshaMilestoneTest';
import { BlockOptions } from '../blocks/types';
import { AshaScreeningDetail as AshaScreeningDetailBlock } from '../blocks/AshaScreeningDetail';

export interface AshaScreeningDetailProps {
  test: AshaMilestoneTest;
}

/**
 * Plantilla de detalle para el informe clínico en PDF del Cribado de Hitos ASHA.
 * Utiliza pdf-lib e incluye el disclaimer regulatorio obligatorio de SaMD Clase IIa.
 */
export async function AshaScreeningDetail(
  props: AshaScreeningDetailProps,
  options: BlockOptions,
): Promise<void> {
  return AshaScreeningDetailBlock(props, options);
}

export default AshaScreeningDetail;
