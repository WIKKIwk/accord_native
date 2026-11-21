import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { PreparationJournal, type JournalState } from './preparationJournal';
import { preparationProductionBatch, preparationProductionBatches, preparationProductionOrder, preparationProductionOrders,
  preparationProductionRolls } from './preparationProductionApi';

type OrdersPage = Awaited<ReturnType<typeof preparationProductionOrders>>;
type OrderPage = Awaited<ReturnType<typeof preparationProductionOrder>>;
type BatchPage = Awaited<ReturnType<typeof preparationProductionBatch>>;
export type ProductionOrder = OrdersPage['orders'][number];
export type ProductionBatch = OrderPage['batches'][number];
export type ProductionRoll = BatchPage['rolls'][number];
type Order = ProductionOrder;
type Batch = ProductionBatch;
type Roll = ProductionRoll;

export const productionViews = [
  { id: 'orders', name: 'Buyurtmalar' }, { id: 'batches', name: 'Batchlar' }, { id: 'rolls', name: 'Rulonlar' },
] as const;
export type ProductionView = typeof productionViews[number]['id'];
export type ProductionRow = { kind: 'order'; order: Order } | { kind: 'batch'; batch: Batch } | { kind: 'roll'; roll: Roll };

export function productionRowKey(row: ProductionRow) {
  if (row.kind === 'order') return row.order.order_id;
  if (row.kind === 'batch') return row.batch.batch_id;
  return row.roll.receipt_name || row.roll.epc;
}

export function createPreparationProductionWorkspaceJournal(session: Session, view: ProductionView,
  filters: () => { query: string; status: string }, changed: (state: JournalState<ProductionRow>) => void) {
  return new PreparationJournal<ProductionRow>(async offset => {
    const options = { ...filters(), offset };
    if (view === 'batches') {
      const page = await preparationProductionBatches(session, options);
      return { ...page, items: page.batches.map(batch => ({ kind: 'batch', batch })) };
    }
    if (view === 'rolls') {
      const page = await preparationProductionRolls(session, options);
      return { ...page, items: page.rolls.map(roll => ({ kind: 'roll', roll })) };
    }
    const page = await preparationProductionOrders(session, options);
    return { ...page, items: page.orders.map(order => ({ kind: 'order', order })) };
  }, productionRowKey, () => sessionReadScope(session), changed);
}

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
