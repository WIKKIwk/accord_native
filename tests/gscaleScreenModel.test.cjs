const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/gscale/gscaleScreenModel.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod.require = name => name === './gscaleMaterialPresentation' ? { materialArchiveSubtitle: batch => batch.active ? 'ACTIVE' : 'CLOSED', materialReceiptContextSummary: () => [] } : name === './gscaleArchive' ? { formatArchiveTimestamp: value => value, archiveSessionFromBatch: value => value } : require(name);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { gscaleDashboardSections } = mod.exports;

function fixture() {
  const calls = [], operator = {
    editDraft: patch => calls.push(['draft', patch]), saveContext: () => calls.push(['save']),
    startBatch: () => calls.push(['start']), stopBatch: () => calls.push(['stop']), manualPrint: () => calls.push(['print']),
    submitSimpleReceipt: () => calls.push(['receipt']), retryBatchState: () => {}, refreshArchive: () => {}, refresh: () => {},
    setWarehouseSetup: (mode, value) => calls.push(['warehouse', mode, value]), beginContextEdit: () => {}, preparationProblem: () => '',
  };
  const state = { draft: { item_code: 'PET', item_name: 'PET', warehouse: 'W', default_warehouse: '', warehouse_mode: 'manual',
    width_text: '500', micron_text: '12', length_text: '125', manual_qty_text: '5', manual_duplicate_text: '1',
    babina_text: '', material_supplier: '', print_mode: 'rfid' }, device: { selection: { transport: 'bluetooth', bluetoothPrinter: { displayName: 'XP' } },
    needsAttention: false }, batch: { resolved: true }, monitor: { batchActive: false, scaleValue: '5 kg', scaleConnectionLabel: 'Scale: ulangan' },
    error: '', notice: '', presetError: '', presetLoading: false, archive: [], archiveError: '', archiveLoading: false, archivePrintingId: '' };
  const control = { hasPrintDevice: true, hasScaleDevice: false, selectedItem: { code: 'PET', name: 'PET', requiresDimensions: true },
    targetWarehouse: 'W', showFields: true, fieldsLocked: false, quantitySource: 'manual', babinaEnabled: false, saveEnabled: true,
    manualStartEnabled: true, manualPrintEnabled: true, manualStopEnabled: true, simpleReady: true, showPrinterSettings: false };
  const screen = { state, control, operator, role: 'material_taminotchi', controlOnly: true, orderLocked: false,
    order: { loading: false, error: null, orders: [{ id: 'o1' }] }, orderStore: { selectedLabel: 'Order', widthLabel: 'Order eni: 500 mm' },
    session: { baseUrl: 'https://test.example' }, orderPicker: () => ({}), itemPicker: () => ({}), warehousePicker: () => ({}), defaultWarehousePicker: () => ({}) };
  const actions = { pick: () => {}, devices: () => {}, chooseApparatus: async () => null, archive: () => {}, confirmArchivePrint: () => {} };
  return { calls, screen, actions };
}
const rows = sections => sections.flatMap(section => section.rows);

test('manual receipt shows order, dimensions and invokes enabled start', () => {
  const { screen, actions, calls } = fixture();
  const items = rows(gscaleDashboardSections(screen, 'control', actions));
  assert.ok(items.some(row => row.label === 'Order tanlang' && row.detail === 'Order'));
  assert.ok(items.some(row => row.label === 'Eni (mm)'));
  const start = items.find(row => row.label === 'Boshlash');
  assert.equal(start.disabled, false); start.press(); assert.deepEqual(calls, [['start']]);
  screen.control.manualStartEnabled = false;
  assert.equal(rows(gscaleDashboardSections(screen, 'control', actions)).find(row => row.label === 'Boshlash').disabled, true);
});

test('simple receipt and active batch expose their separate actions', () => {
  const { screen, actions } = fixture();
  screen.control.simpleReceiptMode = true;
  let items = rows(gscaleDashboardSections(screen, 'control', actions));
  assert.ok(items.some(row => row.label === 'Kirim kg'));
  assert.ok(items.some(row => row.label === 'Kirim qilish'));
  assert.ok(!items.some(row => row.label === 'Boshlash'));
  screen.control.simpleReceiptMode = false;
  screen.control.activeBatch = { order_id: 'o1', width_mm: 500, micron: 12, length_m: 125 };
  screen.state.monitor.batchActive = true;
  items = rows(gscaleDashboardSections(screen, 'control', actions));
  assert.ok(items.some(row => row.label === 'Chop etish'));
  assert.ok(items.some(row => row.label === 'To‘xtatish'));
});

test('server exposes saved default warehouse and ERP endpoint', () => {
  const { screen, actions, calls } = fixture(); screen.controlOnly = false;
  screen.state.draft.default_warehouse = 'W';
  const items = rows(gscaleDashboardSections(screen, 'server', actions));
  assert.ok(items.some(row => row.text === 'https://test.example'));
  items.find(row => row.label === 'Qo‘lda').press();
  assert.deepEqual(calls, [['warehouse', 'manual', 'W']]);
});

test('Material receipt uses exact source device status, two-line switches, picker empties and edit label without changing defaults', () => {
  const { screen, actions } = fixture(); screen.materialReceipt = true;
  screen.state.device.selection.bluetoothPrinter.displayName = '';
  screen.state.draft.item_name = ''; screen.state.draft.item_code = ''; screen.control.targetWarehouse = '';
  const items = rows(gscaleDashboardSections(screen, 'control', actions));
  assert.equal(items.find(row => row.id === 'gscale-device').label, 'XP-P323B • Bluetooth');
  assert.equal(items.find(row => row.id === 'gscale-item').detail, 'Tanlash uchun bosing');
  assert.equal(items.find(row => row.id === 'gscale-warehouse').detail, 'Tanlash uchun bosing');
  assert.deepEqual(items.filter(row => row.kind === 'toggle').map(row => [row.label,row.detail]), [['Miqdor (kg)','Qo‘lda kg'],['Babina','Yo‘q']]);
  screen.state.device.selection = { transport:'offline', offlinePrinter: { displayName:'Zebra', printer:'zebra', printMode:'label' } };
  screen.control.draftSummary = true;
  const offline = rows(gscaleDashboardSections(screen, 'control', actions));
  assert.equal(offline.find(row => row.id === 'gscale-device').label, 'USB printer • Offline');
  assert.equal(offline.find(row => row.id === 'gscale-context-edit').label, 'Batch ma’lumotini tahrirlash');
  screen.materialReceipt = false;
  const legacy = rows(gscaleDashboardSections(screen, 'control', actions));
  assert.equal(legacy.find(row => row.id === 'gscale-device').label, 'USB printer · Offline');
  assert.equal(legacy.find(row => row.id === 'gscale-context-edit').label, 'O‘zgartirish');
});

test('Material snackbar notices are not repeated inline, while existing dashboard notices remain inline', () => {
  const {screen,actions}=fixture();screen.state.notice='Sozlamalar saqlandi';screen.materialReceipt=true;
  assert.equal(rows(gscaleDashboardSections(screen,'control',actions)).some(row=>row.text===screen.state.notice),false);
  screen.materialReceipt=false;
  assert.equal(rows(gscaleDashboardSections(screen,'control',actions)).some(row=>row.text===screen.state.notice),true);
});

test('Material source order loading is a spinner and printer settings use their actual option labels',()=>{
  const {screen,actions}=fixture();screen.materialReceipt=true;screen.order.loading=true;screen.state.device.needsAttention=true;
  screen.control.showPrinterSettings=true;screen.control.selectedPrinter='zebra';
  const items=rows(gscaleDashboardSections(screen,'control',actions));
  assert.deepEqual(items.find(row=>row.loading),{kind:'text',text:'',loading:true});
  assert.equal(items.find(row=>row.id==='gscale-device').detail,undefined);
  assert.equal(items.find(row=>row.id==='gscale-device-change').label,'Almashtirish');
  const settings=gscaleDashboardSections(screen,'control',actions).find(group=>group.title==='Printer sozlamalari');
  assert.deepEqual(settings.rows.filter(row=>row.kind==='action').map(row=>row.label),['Zebra','RFID']);
});
