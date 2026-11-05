import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { PreparationJournal, type JournalState } from './preparationJournal';
import { preparationProductionBatch, preparationProductionOrder, preparationProductionOrders } from './preparationProductionApi';

type OrdersPage = Awaited<ReturnType<typeof preparationProductionOrders>>;
type OrderPage = Awaited<ReturnType<typeof preparationProductionOrder>>;
type BatchPage = Awaited<ReturnType<typeof preparationProductionBatch>>;
type Order = OrdersPage['orders'][number];
type Batch = OrderPage['batches'][number];
type Roll = BatchPage['rolls'][number];

export function createPreparationProductionOrdersJournal(session: Session, filters: () => { query: string; status: string },
  changed: (state: JournalState<Order>) => void) {
  return new PreparationJournal<Order>(async offset => {
    const page = await preparationProductionOrders(session, { ...filters(), offset });
    return { ...page, items: page.orders };
  }, item => item.order_id, () => sessionReadScope(session), changed);
}
export function createPreparationProductionOrderJournal(session: Session, orderId: string,
  changed: (state: JournalState<Batch, Order>) => void) {
  return new PreparationJournal<Batch, Order>(async offset => {
    const page = await preparationProductionOrder(session, orderId, offset);
    return { ...page, items: page.batches, summary: page.order };
  }, item => item.batch_id, () => sessionReadScope(session), changed);
}
export function createPreparationProductionBatchJournal(session: Session, batchId: string,
  changed: (state: JournalState<Roll, Batch>) => void) {
  return new PreparationJournal<Roll, Batch>(async offset => {
    const page = await preparationProductionBatch(session, batchId, offset);
    return { ...page, items: page.rolls, summary: page.batch };
  }, item => item.epc, () => sessionReadScope(session), changed);
}
