import type { CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
import type { openedOrderEditSourceFromJson } from '../workerOpenedOrderEditApi';
/** Source AdminCalculateArgs. Original DTOs stay in the private route registry. */
export class BrigaderCalculateArgs{constructor(readonly template?:CalculateOrderTemplate,readonly pendingOrderId='',readonly trainingMode=false,readonly trainingApparatus='',readonly trainingApparatusId='',readonly openedOrder?:ReturnType<typeof openedOrderEditSourceFromJson>){}}
