import type { CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
import type { ProductionMapDraft } from '../admin/productionMapDraftModel';
export type ProductionMapOrderContext = {
    pendingOrderId: string;
    templateId: string;
    orderCode: string;
    orderName: string;
    productName: string;
    itemCode: string;
    rollCount: number | null;
    widthMm: number | null;
    printValSizeMm: number | null;
    duplicateRezkaLabels: boolean | null;
    includeBobinaInNet: boolean | null;
    standardPrintSide: boolean | null;
    apparatus: string;
    apparatusId: string;
    templateDraft: CalculateOrderTemplate | null;
    templateAction: string;
};
/** Held only by the original Brigader private-flow registry, never serialized in a URL. */
export class BrigaderProductionMapArgs {
    constructor(readonly orderContext: ProductionMapOrderContext | null = null, readonly savedMap: ProductionMapDraft | null = null, readonly readOnly = false, readonly templateOnly = false, readonly lockedNodeIds: ReadonlySet<string> = new Set()) { }
}
