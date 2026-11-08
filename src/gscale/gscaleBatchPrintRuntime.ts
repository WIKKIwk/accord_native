import type { Session } from '../auth';
import { PrintService } from '../printing/printService';
import { gscaleRpsBatchClientPrintConfirm, gscaleRpsBatchClientPrintPrepare, gscaleRpsBatchPrint } from './gscaleBatchApi';
import { printActiveGScaleBatch, type GScalePrintContext } from './gscaleBatchPrint';

export function printGScaleBatch(session: Session, context: GScalePrintContext, refreshBatch: () => Promise<unknown>, beforeWrite?: () => void) {
  return printActiveGScaleBatch(context, {
    printRemote: request => { beforeWrite?.(); return gscaleRpsBatchPrint(session, request, beforeWrite); },
    prepare: request => { beforeWrite?.(); return gscaleRpsBatchClientPrintPrepare(session, request, beforeWrite); },
    confirm: (request, epc) => { beforeWrite?.(); return gscaleRpsBatchClientPrintConfirm(session, request, epc, beforeWrite); },
    printLocal: (request, options) => { beforeWrite?.(); return PrintService.printRps(request, options); },
    refreshBatch,
  });
}
