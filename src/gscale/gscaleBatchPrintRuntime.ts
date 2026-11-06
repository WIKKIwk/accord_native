import type { Session } from '../auth';
import { PrintService } from '../printing/printService';
import { gscaleRpsBatchClientPrintConfirm, gscaleRpsBatchClientPrintPrepare, gscaleRpsBatchPrint } from './gscaleBatchApi';
import { printActiveGScaleBatch, type GScalePrintContext } from './gscaleBatchPrint';

export function printGScaleBatch(session: Session, context: GScalePrintContext, refreshBatch: () => Promise<unknown>) {
  return printActiveGScaleBatch(context, {
    printRemote: request => gscaleRpsBatchPrint(session, request),
    prepare: request => gscaleRpsBatchClientPrintPrepare(session, request),
    confirm: (request, epc) => gscaleRpsBatchClientPrintConfirm(session, request, epc),
    printLocal: (request, options) => PrintService.printRps(request, options),
    refreshBatch,
  });
}
