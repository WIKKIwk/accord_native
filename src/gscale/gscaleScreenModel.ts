import type { ArchiveSession } from './gscaleArchive';
import { archiveSessionFromBatch, formatArchiveTimestamp } from './gscaleArchive';
import { materialArchiveSubtitle, materialReceiptContextSummary } from './gscaleMaterialPresentation';
import type { OperatorControlDraft } from './gscaleDraft';
import type { GScalePickerSpec, useGScaleScreen } from './useGScaleScreen';

type Screen = ReturnType<typeof useGScaleScreen>;
type Action = { kind: 'action'; label: string; detail?: string; disabled?: boolean; id?: string; press(): void };
type Field = { kind: 'field'; label: string; value: string; disabled?: boolean; decimal?: boolean;
  key?: keyof OperatorControlDraft; change(value: string): void; focus?(focused: boolean): void };
type Toggle = { kind: 'toggle'; label: string; detail?: string; value: boolean; disabled?: boolean; change(value: boolean): void };
type Text = { kind: 'text'; text: string; loading?: boolean };
export type GScaleRow = Action | Field | Toggle | Text;
export type GScaleSection = { title?: string; rows: GScaleRow[] };
export type GScaleScreenActions = { pick(spec: GScalePickerSpec): void; devices(): void;
  chooseApparatus(options: Record<string, string>): Promise<string | null>; archive(session: ArchiveSession): void;
  confirmArchivePrint(session: ArchiveSession): void };
const text = (value: string): Text => ({ kind: 'text', text: value });
const button = (label: string, press: () => void, disabled = false, detail?: string, id?: string): Action =>
  ({ kind: 'action', label, press, disabled, detail, id });

export function gscaleDashboardSections(screen: Screen, section: 'control' | 'history' | 'server', actions: GScaleScreenActions): GScaleSection[] {
  const { state, control, operator, role, controlOnly, order, orderLocked, materialReceipt } = screen;
  const draft = state.draft, active = control.activeBatch, selected = state.device.selection;
  if (section === 'history') {
    const rows: GScaleRow[] = materialReceipt ? [text(`${state.archive.length} ta batch`)] : [];
    if (state.archiveLoading) rows.push(text('Yuklanmoqda…'));
    if (state.archiveError) rows.push(text(state.archiveError));
    if (!state.archiveLoading && !state.archive.length) rows.push(text(materialReceipt ? `${controlOnly ? 'Print tarixi' : 'Arxiv'} hali bo'sh.` : `${controlOnly ? 'Print tarixi' : 'Arxiv'} hali bo‘sh.`));
    for (const batch of state.archive) {
      const net = batch.net_qty > 0 ? batch.net_qty : batch.total_qty, gross = batch.gross_qty > 0 ? batch.gross_qty : net;
      rows.push(button(batch.item_name || batch.item_code || '-', () => actions.archive(batch), false,
        materialReceipt ? `${materialArchiveSubtitle(batch)} · ${gross.toFixed(3)} / ${net.toFixed(3)} ${batch.unit || 'kg'}` : `${batch.active ? 'ACTIVE' : 'CLOSED'} · ${batch.warehouse} · ${formatArchiveTimestamp(batch.started_at)} · ${gross.toFixed(3)} / ${net.toFixed(3)} ${batch.unit}`));
      rows.push(button('Partiya QR chop etish', () => actions.confirmArchivePrint(batch), !!state.archivePrintingId));
    }
    if (!controlOnly) rows.unshift(button('Yangilash', () => void operator.refreshArchive(), state.archiveLoading));
    return [{ title: controlOnly ? 'Print tarixi' : 'Arxiv', rows }];
  }
  if (section === 'server') {
    const server = selected?.transport === 'wifi' ? selected.server : null;
    return [{ title: 'Server', rows: [button('Printer yoki tarozi tanlash', actions.devices),
      text(server ? `${server.handshake.serverName} · ${server.endpoint.baseUrl}` : 'Server tanlanmagan'),
      text(state.monitor.serverLabel), text(state.monitor.scaleConnectionLabel), text(state.monitor.printerLabel),
      text(`${state.monitor.batchValue} · ${state.monitor.latencyMs > 0 ? `${state.monitor.latencyMs} ms` : '—'}`),
      text('RPS driver'), text(server?.endpoint.baseUrl ?? '—'), text('RS / ERP boshqaruvi'), text(screen.session.baseUrl),
      text('Ombor tanlash'), button('Qo‘lda', () => operator.setWarehouseSetup('manual', draft.default_warehouse)),
      button('Standart', () => actions.pick(screen.defaultWarehousePicker()), false,
        draft.default_warehouse ? `${draft.warehouse_mode === 'default' ? 'Standart ombor' : 'Saqlangan standart'}: ${draft.default_warehouse}` : undefined),
      ...(state.error ? [text(state.error)] : []), button('Yangilash', () => void operator.refresh(), state.requestInFlight)] }];
  }
  const sections: GScaleSection[] = [], deviceLabel = selected?.transport === 'wifi'
    ? state.printerStatusOverride || (state.monitor.hasPrinterState ? state.monitor.printerLabel
      : state.error ? 'Printer holati olinmadi' : 'Printer holati olinmoqda')
    : selected?.transport === 'bluetooth' ? materialReceipt ? `${selected.bluetoothPrinter.displayName.trim() || 'XP-P323B'} • Bluetooth` : `${selected.bluetoothPrinter.displayName} · Bluetooth`
      : selected?.transport === 'offline' ? materialReceipt ? 'USB printer • Offline' : 'USB printer · Offline' : 'Printer yoki tarozi tanlash';
  const deviceRows: GScaleRow[] = [button(deviceLabel, actions.devices, false, !materialReceipt && state.device.needsAttention ? 'Qurilmani qayta tanlang' : undefined, 'gscale-device')];
  if (materialReceipt && control.hasPrintDevice) deviceRows.push(button('Almashtirish', actions.devices, false, undefined, 'gscale-device-change'));
  if (!controlOnly && selected?.transport === 'wifi') deviceRows.push(text(state.monitor.latencyMs > 0 ? `${state.monitor.latencyMs} ms` : '—'));
  if (materialReceipt && selected?.transport === 'offline' && !control.hasScaleDevice) {
    const printer = selected.offlinePrinter;
    deviceRows.push(text(printer.displayName || 'Offline USB printer'), text(`${printer.printer.toUpperCase()} • ${printer.printMode.toUpperCase()} avtomatik tanlandi.`),
      button('Print rejimini almashtirish', actions.devices));
  }
  if (control.hasScaleDevice) deviceRows.push(text(`Joriy kg: ${state.monitor.scaleValue} · ${state.monitor.scaleConnectionLabel}`));
  if (!state.batch.resolved && control.hasPrintDevice) deviceRows.push(text('Batch holati tekshirilmoqda…'),
    button('Holatni qayta tekshirish', () => void operator.retryBatchState(), state.actionLoading || state.manualPrintLoading || state.requestInFlight));
  const controlError = operator.preparationProblem() || state.error;
  if (controlError) deviceRows.push(text(controlError));
  if (state.presetLoading) deviceRows.push(text('Yuklanmoqda…'));
  if (state.notice && !materialReceipt) deviceRows.push(text(state.notice));
  sections.push({ rows: deviceRows });

  if (controlOnly) {
    const rows: GScaleRow[] = [];
    if (order.loading) rows.push(materialReceipt ? { kind: 'text', text: '', loading: true } : text('Orderlar yuklanmoqda…'));
    else if (order.error != null) rows.push(text(`Orderlar yuklanmadi: ${String(order.error)}`), button('Yangilash', () => void screen.orderStore.load()));
    else rows.push(button('Order tanlang', () => actions.pick(screen.orderPicker()), orderLocked || !order.orders.length,
      screen.orderStore.selectedLabel || (order.orders.length ? '' : 'Buyurtma topilmadi'), 'gscale-order'));
    if (screen.orderStore.widthLabel) rows.push(text(screen.orderStore.widthLabel));
    sections.push({ title: 'Order', rows });
  }
  const rows: GScaleRow[] = [];
  if (active || control.draftSummary) {
    if (active?.order_id) rows.push(text(`Faol batch orderi: ${active.order_id}`));
    if (materialReceipt) rows.push(...materialReceiptContextSummary({ itemName: control.selectedItem?.name || control.selectedItem?.code || '', warehouse: control.targetWarehouse,
      width: active ? active.width_mm : control.width, micron: active ? active.micron : control.micron, length: active ? active.length_m : control.length,
      quantitySource: control.quantitySource, babina: control.babinaEnabled, tareKg: control.tareKg }).map(text));
    else {
      rows.push(text(`${control.selectedItem?.name || control.selectedItem?.code || '—'} · ${control.targetWarehouse || '—'}`));
      rows.push(text(`Eni: ${active?.width_mm ?? (draft.width_text || '—')} · Mikron: ${active?.micron ?? (draft.micron_text || '—')} · Metraj: ${active?.length_m ?? (draft.length_text || '—')}`));
    }
    rows.push(button(materialReceipt ? 'Batch ma’lumotini tahrirlash' : 'O‘zgartirish', () => operator.beginContextEdit(), state.actionLoading || state.manualPrintLoading, undefined, 'gscale-context-edit'));
  }
  const field = (label: string, key: keyof OperatorControlDraft, disabled: boolean, focus?: (focused: boolean) => void): Field => ({
    kind: 'field', key, label, value: String(draft[key]), disabled, decimal: true,
    change: value => operator.editDraft({ [key]: value }), focus });
  if (control.showFields) {
    if (draft.warehouse_mode === 'default') rows.push(text(draft.default_warehouse ? `Standart ombor: ${draft.default_warehouse}` : 'Default ombor tanlanmagan.'));
    else rows.push(button('Ombor tanlang', () => actions.pick(screen.warehousePicker()),
      control.fieldsLocked || (!controlOnly && !draft.item_code), control.targetWarehouse || (materialReceipt ? 'Tanlash uchun bosing' : undefined), 'gscale-warehouse'));
    if (!controlOnly && !draft.item_code) rows.push(text('Avval mahsulot tanlang, keyin ombor tanlash ochiladi.'));
    rows.push(button('Mahsulot tanlang', () => actions.pick(screen.itemPicker()), control.fieldsLocked, draft.item_name || draft.item_code || (materialReceipt ? 'Tanlash uchun bosing' : undefined), 'gscale-item'));
    if (!control.simpleReceiptMode && (control.selectedItem?.requiresDimensions || (role === 'material_taminotchi' && !control.selectedItem))) {
      rows.push(field('Eni (mm)', 'width_text', control.fieldsLocked), field('Mikron', 'micron_text', control.fieldsLocked));
      if (control.widthInvalid) rows.push(text(materialReceipt ? "To'g'ri eni kiriting" : 'To‘g‘ri eni kiriting'));
      if (control.widthRangeError) rows.push(text(control.widthRangeError));
      if (control.micronInvalid) rows.push(text(materialReceipt ? "To'g'ri mikron kiriting" : 'To‘g‘ri mikron kiriting'));
    }
    if (!control.simpleReceiptMode && control.selectedItem) {
      rows.push(field('Metraj (m)', 'length_text', control.fieldsLocked));
      if (control.lengthInvalid) rows.push(text(materialReceipt ? "To'g'ri metraj kiriting" : 'To‘g‘ri metraj kiriting'));
    }
    if (!control.simpleReceiptMode) {
      rows.push({ kind: 'toggle', label: materialReceipt ? 'Miqdor (kg)' : control.quantitySource === 'manual' ? 'Qo‘lda kg' : 'Tarozidan kg',
        ...(materialReceipt ? { detail: control.quantitySource === 'manual' ? 'Qo‘lda kg' : 'Tarozidan kg' } : {}),
        value: control.quantitySource === 'manual', disabled: control.fieldsLocked,
        change: value => operator.editDraft({ quantity_source: value ? 'manual' : 'scale' }) });
      rows.push({ kind: 'toggle', label: 'Babina', ...(materialReceipt ? { detail: control.babinaEnabled ? 'Bor' : 'Yo‘q' } : {}), value: control.babinaEnabled, disabled: control.fieldsLocked,
        change: value => operator.editDraft({ babina_enabled: value }) });
      rows.push(button('Saqlash', () => void operator.saveContext(), !control.saveEnabled, undefined, 'gscale-save'));
    }
  }
  if (control.babinaEnabled) {
    rows.push(field('Babina og‘irligi', 'babina_text', state.actionLoading || state.manualPrintLoading));
    if (control.babinaInvalid) rows.push(text('Masalan: 0.78'));
  }
  if (control.quantitySource === 'manual') {
    const quantityLocked = state.actionLoading || state.manualPrintLoading || state.simpleLoading;
    rows.push(field(control.simpleReceiptMode ? 'Kirim kg' : 'Qo‘lda brutto kg', 'manual_qty_text', quantityLocked,
      focused => { if (focused) operator.handleManualQtyTap(); else operator.restoreManualQtyIfEmpty(); }));
    if (!control.simpleReceiptMode) rows.push(field('Duplicate soni', 'manual_duplicate_text', quantityLocked));
    if (control.manualQtyInvalid) rows.push(text(materialReceipt ? 'Masalan: 5 yoki 4.22' : 'Manual kg ni to‘g‘ri kiriting'));
    if (control.duplicateInvalid) rows.push(text(materialReceipt ? 'Masalan: 1 yoki 5' : 'Duplicate sonini to‘g‘ri kiriting'));
  }
  if (role === 'material_taminotchi' && !control.simpleReceiptMode) rows.push(button('Ta’minotchi', () => actions.pick({ title: 'Ta’minotchi', hint: 'Qidirish', pageSize: 50,
    load: async () => ['', 'Xitoy', 'Sirdaryo'].map(value => ({ key: value, title: value || 'Tanlanmagan',
      select: () => operator.editDraft({ material_supplier: value }) })) }), state.actionLoading || state.manualPrintLoading, draft.material_supplier || 'Tanlanmagan'));
  if (control.quantitySource === 'manual') {
    if (control.simpleReceiptMode) rows.push(button('Kirim qilish', () => void operator.submitSimpleReceipt(), !control.simpleReady, undefined, 'gscale-receive'));
    else if (state.monitor.batchActive) rows.push(button('Chop etish', () => void operator.manualPrint(), !control.manualPrintEnabled, undefined, 'gscale-print'),
      button('To‘xtatish', () => void operator.stopBatch(), !control.manualStopEnabled, undefined, 'gscale-stop'));
    else rows.push(button('Boshlash', () => void operator.startBatch(actions.chooseApparatus, false), !control.manualStartEnabled, undefined, 'gscale-start'));
  } else if (!control.simpleReceiptMode) {
    rows.push(button(state.monitor.batchActive ? 'To‘xtatish' : 'Boshlash', () => {
      if (state.monitor.batchActive) void operator.stopBatch(); else void operator.startBatch(actions.chooseApparatus, true);
    }, !control.scaleActionEnabled, undefined, state.monitor.batchActive ? 'gscale-stop' : 'gscale-start'));
    if (state.monitor.batchActive) rows.push(text(control.scalePrintReady ? 'Stable kg avtomatik chop etiladi.' : 'Stable kg kutilmoqda.'));
  }
  if (materialReceipt && control.quantitySource === 'manual' && !control.simpleReceiptMode && !state.monitor.batchActive) rows.push(text('Avval Boshlash, keyin Chop etish orqali print qiling.'));
  if (materialReceipt && !control.simpleReceiptMode && !state.monitor.batchActive && !control.hasPrintDevice) rows.push(text('Boshlash uchun avval Bluetooth printer yoki tarozini tanlang. Saqlash qurilmasiz ham ishlaydi.'));
  if (materialReceipt && state.manualPrintLoading) rows.push(text('Chop etish yuborilmoqda...'));
  if (materialReceipt && !control.simpleReceiptMode && control.quantitySource === 'scale' && !state.monitor.batchActive && control.hasScaleDevice && control.scaleQty == null) rows.push(text('Scale ulangan va kg kelganda tugma aktiv bo‘ladi.'));
  sections.push({ rows });
  if (!controlOnly && active?.prints.length) sections.push({ title: 'Batch QR', rows: [
    button(`${active.prints.length} ta QR`, () => actions.archive(archiveSessionFromBatch(active))),
  ] });
  if (control.showPrinterSettings) sections.push({ title: 'Printer sozlamalari', rows: [
    button(materialReceipt ? control.selectedPrinter === 'godex' ? 'GoDEX' : 'Zebra' : 'Printer', () => actions.pick({ title: materialReceipt ? 'Printer sozlamalari' : 'Printer', hint: 'Qidirish', pageSize: 50, load: async () => (operator.isPrinterRestricted?.() ? ['zebra'] : ['zebra', 'godex'])
      .map(value => ({ key: value, title: value === 'zebra' ? 'Zebra' : 'GoDEX', select: () => operator.editDraft({ printer: value,
        ...(value === 'godex' ? { print_mode: 'label' } : {}) }) })) }), control.printerLocked, materialReceipt ? undefined : control.selectedPrinter),
    button(materialReceipt ? draft.print_mode === 'label' ? 'Faqat yorliq' : 'RFID' : 'Chop etish turi', () => actions.pick({ title: materialReceipt ? 'Printer sozlamalari' : 'Chop etish turi', hint: 'Qidirish', pageSize: 50,
      load: async () => ['rfid', 'label'].map(value => ({ key: value, title: value === 'rfid' ? 'RFID' : 'Faqat yorliq',
        select: () => operator.editDraft({ print_mode: value }) })) }), control.printerLocked || control.selectedPrinter === 'godex',
      materialReceipt ? undefined : draft.print_mode === 'label' ? 'Faqat yorliq' : 'RFID'),
    ...(materialReceipt ? [text('ERP batch/submit RS serverda, RPS faqat chop etadi.')] : []),
  ] });
  return sections;
}
