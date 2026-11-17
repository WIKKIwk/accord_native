import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { NativeSheetOptions } from '../nativeSheet';
import { localizedMethod } from '../shared/localization';
import { MobileApiException } from '../shared/mobileApiException';
import { QolipBlockCreateSheet } from './QolipBlockCreateSheet';
import { QolipCellAttachSheet } from './QolipCellAttachSheet';
import { QolipCellDetail } from './QolipCellDetail';
import { QolipGridCellPicker } from './QolipGridCellPicker';
import { QolipHomeBlockChoice, QolipHomeDialog, QolipHomeMenu } from './QolipHomeActions';
import { QolipHomePicker } from './QolipHomePicker';
import { QolipLocationChoice } from './QolipLocationChoice';
import { QolipQrScannerScreen } from './QolipQrScanner';
import { QolipTakeSheet } from './QolipTakeSheet';
import { useQolipRole } from './QolipRoleContext';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipCellDetailChoice } from './qolipCellDetailState';
import { qolipWorkers, qolipIssueCheckout, type QolipWorkerOption } from './qolipCheckoutApi';
import { qolipErrorMessage } from './qolipErrorMessage';
import { qolipCellAlternatives } from './qolipGridLogic';
import type { QolipHomeDialogModel, QolipHomeMenuProps } from './qolipHomeActionTypes';
import { issueQolipHomeSelection, moveQolipHomeLocations, qolipHomeQuantity, type QolipHomeTarget } from './qolipHomeCommands';
import { qolipLocationSearchDocument } from './qolipHomeLogic';
import type { QolipHomeOwnerSnapshot } from './qolipHomeOwnerState';
import { qolipMoveLocation, qolipMoveLocations, qolipSaveLocation, type QolipLocationEntry } from './qolipLocationsApi';
import { qolipMoveTargetBlocks } from './qolipLocationLogic';
import { qolipScanQr, type QolipCellQr } from './qolipQrApi';
import type { QolipQrScannerMode, QolipQrScannerResult } from './qolipQrScannerState';
import { filterQolipSearch, QolipSearchDocument, QolipSearchQuery } from './qolipSearchEngine';
import { useQolipCatalogEditors } from './useQolipCatalogEditors';
import { useQolipPresentation } from './useQolipPresentation';
import { useQolipPrinting } from './useQolipPrinting';
import { useQolipText } from './useQolipText';

const normalized = (value: string) => value.trim().toLowerCase();
type Presentation = ReturnType<typeof useQolipPresentation>;
export function useQolipHomeActions(home: QolipHomeOwnerSnapshot) {
  const role = useQolipRole(), { text, locale } = useQolipText(), sheet = useQolipPresentation(), nested = useQolipPresentation();
  const printing = useQolipPrinting(), editors = useQolipCatalogEditors(), latest = useRef(home);
  useLayoutEffect(() => { latest.current = home; }, [home]);
  const [dialog, setDialog] = useState<QolipHomeDialogModel | null>(null), pending = useRef(new Set<() => void>());
  const current = role.isCurrent;
  useEffect(() => {
    const retire = () => { if (!current()) { sheet.close(); nested.close(); setDialog(null); for (const finish of pending.current) finish(); pending.current.clear(); } };
    const stop = role.boundary.subscribe(retire);
    const outstanding = pending.current;
    return () => { stop(); for (const finish of outstanding) finish(); outstanding.clear(); };
  }, [role.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocks = () => latest.current.home.kind === 'blocks' ? latest.current.home.tabs.map(tab => tab.block) : [];
  const refresh = async (name: string) => {
    if (!current() || !latest.current.actions) return [];
    return latest.current.actions.refreshLocations(name);
  };
  const locationsFor = async (name: string) => {
    if (!current() || !latest.current.actions) return [];
    return latest.current.actions.locationsFor(name);
  };
  const show = <T,>(render: (done: (result: T) => void, close: () => void) => ReactNode, options: NativeSheetOptions = {}, presenter = sheet): Promise<T | null> => {
    if (!current() || presenter.isOpen()) return Promise.resolve(null);
    return new Promise(resolve => {
      let result: T | null = null, settled = false;
      const finish = () => { if (settled) return; settled = true; pending.current.delete(finish); resolve(current() ? result : null); };
      pending.current.add(finish);
      presenter.open(render(value => { if (current()) { result = value; presenter.close(); } }, () => presenter.close()), { dismissible: true, ...options, onDismiss: finish });
    });
  };
  const menu = (props: Omit<QolipHomeMenuProps, 'choose'>) => show<string>(done => <QolipHomeMenu {...props} choose={done} />, { compact: true, fitContent: true });
  const fail = (error: unknown, fallback: string) => { if (current()) role.notice(qolipErrorMessage(error, locale, text(fallback))); };
  const quantity = (item: QolipLocationEntry): Promise<number | null> => {
    if (item.quantity <= 1) return Promise.resolve(1);
    return new Promise(resolve => {
      let input = String(item.quantity), settled = false;
      const finish = (value: number | null) => { if (settled) return; settled = true; pending.current.delete(cancel); setDialog(null); resolve(current() ? value : null); };
      const cancel = () => finish(null); pending.current.add(cancel);
      const model: QolipHomeDialogModel = { title: text('home.mold_count'), input,
        helper: text('home.max_count', { count: item.quantity }), confirm: text('action.continue'), cancel: text('action.cancel'),
        change: value => { input = value; }, close: cancel,
        accept: () => { const value = qolipHomeQuantity(input, item.quantity); if (value.error) setDialog({ ...model, error: text(value.error, { count: item.quantity }) }); else finish(value.quantity); } };
      setDialog(model);
    });
  };
  const confirm = (title: string, message: string, label: string): Promise<boolean> => new Promise(resolve => {
    let settled = false;
    const finish = (value: boolean) => { if (settled) return; settled = true; pending.current.delete(cancel); setDialog(null); resolve(current() && value); };
    const cancel = () => finish(false); pending.current.add(cancel);
    setDialog({ title, message, confirm: label, cancel: text('action.cancel'), change: () => {}, accept: () => finish(true), close: cancel });
  });
  const chooseWorker = (presenter: Presentation = sheet): Promise<QolipWorkerOption | null> => {
    const future = qolipWorkers(role.session, '', current); void future.catch(() => {});
    return show<QolipWorkerOption>((done, close) => <QolipHomePicker<QolipWorkerOption> title={text('home.choose_worker')} hint={text('home.worker_search')}
      boundary={role.boundary} close={close} itemKey={item => item.id} itemTitle={item => item.name} itemSubtitle={item => item.level}
      loadPage={async (query, offset, limit) => { const rows = await future, prepared = new QolipSearchQuery(query); return rows.filter(worker => !query.trim() || prepared.matches(new QolipSearchDocument([worker.name, worker.level]))).slice(offset, offset + limit); }}
      select={items => done(items[0])} />, {}, presenter);
  };
  const take = async (item: QolipLocationEntry) => {
    const taken = await show<boolean>(done => <QolipTakeSheet item={item} chooseWorker={() => chooseWorker(nested)} saved={() => done(true)} />, { fitContent: true });
    if (taken && current()) void refresh(item.block).catch(() => {});
  };
  const pickBlock = async (options: readonly QolipBlock[]): Promise<QolipBlock | null> => {
    if (options.length === 1) return options[0];
    return show<QolipBlock>(done => <QolipHomeBlockChoice title={text('home.block_select')} blocks={options} choose={done} />, { compact: true, fitContent: true });
  };
  const pickCell = (block: QolipBlock, excludeCellLabel?: string | null) => show<string>(done => <QolipGridCellPicker boundary={role.boundary}
    title={text('home.select_cell', { block: block.name })} excludeCellLabel={excludeCellLabel} select={done} />);
  const move = async (items: readonly QolipLocationEntry[], target?: QolipHomeTarget, bulk = false, exclude?: string) => {
    if (!items.length || !current()) return;
    try {
      if (!target) {
        const available = qolipMoveTargetBlocks({ blocks: blocks(), source: items[0], supportsCrossBlockMove: latest.current.data?.supports_cross_block_move === true });
        const block = await pickBlock(available); if (!block || !current()) return;
        const cell = await pickCell(block, normalized(block.name) === normalized(items[0].block) ? exclude ?? (bulk ? items[0].location_label : undefined) : null);
        if (!cell || !current()) return;
        target = { block, rowLetter: cell[0], columnNumber: Number(cell.slice(1)) };
      }
      const count = bulk ? undefined : await quantity(items[0]); if (count === null || !current()) return;
      const result = await moveQolipHomeLocations(items, target, { current, refresh,
        single: (item, destination, amount) => qolipMoveLocation(role.session, { locationId: item.id, targetBlock: destination.block, rowLetter: destination.rowLetter, columnNumber: destination.columnNumber, quantity: amount }, current),
        multiple: (rows, destination) => qolipMoveLocations(role.session, { locations: rows, targetBlock: destination.block, rowLetter: destination.rowLetter, columnNumber: destination.columnNumber }, current) }, count ?? undefined);
      if (!result || !current()) return;
      if (result.kind === 'unconfirmed') { role.notice(text('transfer.target_unconfirmed', { location: result.location })); return; }
      const index = blocks().findIndex(block => normalized(block.name) === normalized(target!.block.name)); if (index >= 0) latest.current.actions?.select(index);
      role.notice(text('transfer.moved', { item: bulk ? localizedMethod('qolipCount', locale, { count: items.length }) : items[0].item_name, block: target.block.name, cell: `${target.rowLetter}${target.columnNumber}` }));
    } catch (error) { fail(error, 'transfer.failed'); }
  };
  const attach = async (target: QolipHomeTarget) => {
    const saved = await show<boolean>(done => <QolipCellAttachSheet session={role.session} boundary={role.boundary} blocks={blocks()}
      initialBlock={target.block} rowLetter={target.rowLetter} columnNumber={target.columnNumber} saved={result => {
        role.notice(text(result.products.length === 1 ? 'home.saved_one' : 'home.saved_many', { code: result.products[0].qolip_code, count: result.products.length, cell: `${result.target.rowLetter}${result.target.columnNumber}` })); done(true);
      }} />);
    if (saved && current()) void refresh(target.block.name).catch(() => {});
  };
  const chooseLocation = (title: string, options: readonly QolipLocationEntry[]) => show<QolipLocationEntry>(done => <QolipLocationChoice title={title} options={options} boundary={role.boundary} choose={done} />, { compact: true, fitContent: true });
  const openCell = async (block: QolipBlock, letter: string, row: number, items: readonly QolipLocationEntry[]) => {
    const target = { block, rowLetter: letter, columnNumber: row }, label = `${letter}${row}`;
    if (!items.length) { await attach(target); return; }
    const all = await locationsFor(block.name); if (!current()) return;
    const alternatives = qolipCellAlternatives(label, all);
    const choice = await show<QolipCellDetailChoice>(done => <QolipCellDetail cellLabel={label} items={items} {...alternatives} boundary={role.boundary} choose={done} />, { fitContent: true });
    if (!choice || !current()) return;
    if (choice.kind === 'take') await take(choice.item);
    else if (choice.kind === 'move-out') await move([choice.item], undefined, false, label);
    else if (choice.kind === 'bulk-move') await move(choice.items, undefined, true);
    else if (choice.kind === 'add') await attach(target);
    else { const selected = await chooseLocation(text(choice.kind === 'place-unplaced' ? 'home.choose_unplaced' : 'home.choose_move'), choice.kind === 'place-unplaced' ? alternatives.unplaced : alternatives.movableIn); if (selected) await move([selected], target); }
  };
  const issue = async () => {
    try {
      const all = (await Promise.all(blocks().map(block => locationsFor(block.name)))).flat().filter(item => item.quantity > 0)
        .sort((a, b) => a.item_name.toLowerCase() < b.item_name.toLowerCase() ? -1 : a.item_name.toLowerCase() > b.item_name.toLowerCase() ? 1 : a.qolip_code.toLowerCase() < b.qolip_code.toLowerCase() ? -1 : a.qolip_code.toLowerCase() > b.qolip_code.toLowerCase() ? 1 : 0);
      if (!current()) return;
      if (!all.length) { role.notice(text('home.no_placed_for_issue')); return; }
      const cache = new Map<string, Promise<QolipLocationEntry[] | null>>();
      const selection = await show<{ items: QolipLocationEntry[]; multi: boolean }>((done, close) => <QolipHomePicker<QolipLocationEntry> title={text('home.issue_picker_title')} hint={text('home.mold_code_or_product_search')}
        boundary={role.boundary} multiple close={close} itemKey={item => item.id} itemTitle={item => item.item_name.trim() ? item.item_name : item.qolip_code}
        itemSubtitle={item => [item.qolip_code, String(item.size), item.block, item.location_label, localizedMethod('qolipCount', locale, { count: item.quantity })].filter(value => value.trim()).join(' • ')}
        loadPage={async (query, offset, limit) => { if (cache.size >= 8 && !cache.has(query)) cache.clear(); let future = cache.get(query); if (!future) { future = filterQolipSearch(all, query, qolipLocationSearchDocument, { isCurrent: current }); cache.set(query, future); } return (await future)?.slice(offset, offset + limit) ?? []; }}
        select={(items, multi) => done({ items, multi })} />);
      if (!selection || !current()) return;
      if (!selection.multi) { await take(selection.items[0]); return; }
      const worker = await chooseWorker(); if (!worker || !current()) return;
      if (!await confirm(text('home.issue_confirm_title'), text('home.issue_confirm_message', { count: selection.items.length, worker: worker.name }), text('action.issue'))) return;
      const result = await issueQolipHomeSelection(selection.items, worker.id, { current, refresh, issue: (item, workerId) => qolipIssueCheckout(role.session, { locationId: item.id, quantity: 1, workerId }, current) });
      if (!result || !current()) return;
      if (!result.failed) role.notice(text('home.issued_to', { count: result.success, worker: worker.name }));
      else if (result.success) role.notice(text('home.issued_partial', { success: result.success, failed: result.failed }));
      else fail(result.firstError, 'home.take_failed');
    } catch (error) { fail(error, 'home.load_failed'); }
  };
  const scan = (mode: QolipQrScannerMode): Promise<QolipQrScannerResult | null> => show<QolipQrScannerResult>((done, close) => <QolipQrScannerScreen session={role.session} boundary={role.boundary} mode={mode} onClose={close} onResult={done} />, { presentation: 'page' });
  const blockForCell = (cell: QolipCellQr) => blocks().find(block => normalized(block.name) === normalized(cell.block) && normalized(block.warehouse) === normalized(cell.warehouse));
  const scanAction = async () => {
    try {
      const raw = await scan('universal'); if (typeof raw !== 'string' || !current()) return;
      const result = await qolipScanQr(role.session, raw, current); if (!current()) return;
      if (result.kind === 'cell') {
        const cell = result.cell_qr, block = blockForCell(cell); if (!block) { role.notice(text('home.cell_not_assigned')); return; }
        const locations = await refresh(block.name); if (!current()) return;
        const items = locations.filter(item => normalized(item.row_letter) === normalized(cell.row_letter) && item.column_number === cell.column_number);
        const selected = await menu({ title: text('home.cell_title', { cell: cell.location_label }), subtitle: `${block.name} • ${block.warehouse}`, actions: [
          { id: 'place', icon: 'add_location_alt', symbol: 'plus.square', label: text('home.add_mold') }, { id: 'take', icon: 'assignment_returned', symbol: 'arrow.down.doc', label: text(items.length ? 'home.take_count' : 'home.empty_cell', { count: items.length }), disabled: !items.length }] });
        if (selected === 'place') await attach({ block, rowLetter: cell.row_letter, columnNumber: cell.column_number });
        else if (selected === 'take') { const item = items.length === 1 ? items[0] : await chooseLocation(text('home.choose_mold_from_cell', { cell: cell.location_label }), items); if (item) await take(item); }
      } else {
        const { product, location } = result;
        const selected = await menu({ title: product.name.trim() ? product.name : product.qolip_code, subtitle: `${product.qolip_code} • ${product.size}`, info: location ? `${location.block} • ${location.location_label} • ${localizedMethod('qolipCount', locale, { count: location.quantity })}` : text('home.not_in_cell'),
          actions: [{ id: 'place', icon: 'add_location_alt', symbol: 'plus.square', label: text(location ? 'home.place_in_other_cell' : 'home.place_in_cell') }, { id: 'issue', icon: 'person_add_alt_1', symbol: 'person.badge.plus', label: text('home.issue_to_worker'), disabled: !location }], note: location ? undefined : text('home.place_before_issue') });
        if (selected === 'issue' && location) { await take(location); return; }
        if (selected !== 'place' || !current()) return;
        const method = await menu({ title: text('home.choose_cell_method'), actions: [{ id: 'scan', icon: 'qr_code_scanner', symbol: 'qrcode.viewfinder', label: text('home.cell_qr_scan') }, { id: 'select', icon: 'grid_view', symbol: 'square.grid.3x3', label: text('home.select_from_list') }] });
        let target: QolipHomeTarget | null = null;
        if (method === 'scan') { const cell = await scan('cell'); if (cell && typeof cell !== 'string') { const block = blockForCell(cell); if (!block) { role.notice(text('home.cell_not_assigned')); return; } target = { block, rowLetter: cell.row_letter, columnNumber: cell.column_number }; } }
        else if (method === 'select') { const block = await pickBlock(blocks()); if (block) { const label = await pickCell(block); if (label) target = { block, rowLetter: label[0], columnNumber: Number(label.slice(1)) }; } }
        if (!target || !current()) return;
        await qolipSaveLocation(role.session, { ...target, product, quantity: location?.quantity ?? 1 }, current); if (!current()) return;
        if (location) void refresh(location.block).catch(() => {}); void refresh(target.block.name).catch(() => {});
        role.notice(text('home.moved_to', { item: product.qolip_code, block: target.block.name, cell: `${target.rowLetter}${target.columnNumber}` }));
      }
    } catch (error) { if (error instanceof MobileApiException && error.code === 'qolip_code_not_found') role.notice(text('home.qr_lookup_failed')); else fail(error, 'home.qr_check_failed'); }
  };
  const createBlock = async (initialWarehouse?: string, hideWarehouse = false) => {
    const data = latest.current.data; if (!data || !current()) return;
    const created = await show<QolipBlock>(done => <QolipBlockCreateSheet session={role.session} boundary={role.boundary} warehouses={data.warehouses} initialWarehouse={initialWarehouse} showWarehouseField={!hideWarehouse} saved={done} />, { fitContent: true });
    if (created && current()) await latest.current.actions?.retry();
  };
  const add = async () => {
    const data = latest.current.data; if (!data?.warehouses.length || !current()) return;
    const selected = await menu({ actions: [{ id: 'block', icon: 'view_module', symbol: 'square.grid.2x2', label: text('blocks.add') }, ...(blocks().length ? [{ id: 'spec', icon: 'add_location_alt' as const, symbol: 'plus.square' as const, label: text('home.mold_storage_attach') }] : [])] });
    if (selected === 'block') await createBlock(); else if (selected === 'spec') await editors.openSpec();
  };
  const run = (action: () => Promise<unknown>) => { if (current()) void action().catch(error => fail(error, 'home.load_failed')); };
  return { openCell: (block: QolipBlock, letter: string, row: number, items: readonly QolipLocationEntry[]) => run(() => openCell(block, letter, row, items)),
    printCell: (block: QolipBlock, letter: string, row: number) => run(() => printing.printCell(block, letter, row)),
    addBlock: () => { const selected = latest.current.home; if (selected.kind === 'blocks') run(() => createBlock(selected.selected.block.warehouse, true)); },
    selectFab: (id: string) => run(id === 'issue' ? issue : id === 'scan' ? scanAction : add),
    fabActions: [...(home.home.kind === 'blocks' ? [{ id: 'issue', icon: 'person_add_alt_1', symbol: 'person.badge.plus', label: text('home.issue_title') }, { id: 'scan', icon: 'qr_code_scanner', symbol: 'qrcode.viewfinder', label: text('home.scan') }] : []), ...(home.data?.warehouses.length ? [{ id: 'add', label: text('home.attach') }] : [])],
    content: <><QolipHomeDialog model={dialog} />{editors.content}</> };
}
