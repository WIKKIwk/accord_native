const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/gscale/gscaleScreenModel.ts'), loaded = new Module(file, module);
loaded.filename = file; loaded.paths = module.paths;
loaded.require = name => name === './gscaleArchive' ? { formatArchiveTimestamp: value => value, archiveSessionFromBatch: value => value } : require(name);
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { gscaleDashboardSections } = loaded.exports;
function fixture(restricted) {
  const operator = { isPrinterRestricted: () => restricted, editDraft() {}, preparationProblem: () => '' };
  const state = { draft: { item_code: '', item_name: '', warehouse: '', default_warehouse: '', warehouse_mode: 'manual',
    width_text: '', micron_text: '', length_text: '', manual_qty_text: '', manual_duplicate_text: '', babina_text: '', material_supplier: '', print_mode: 'rfid' },
    device: { selection: null, needsAttention: false }, batch: { resolved: true }, monitor: { batchActive: false, scaleValue: '', scaleConnectionLabel: '' },
    error: '', notice: '', presetError: '', presetLoading: false, archive: [], archiveError: '', archiveLoading: false, archivePrintingId: '' };
  const control = { hasPrintDevice: false, hasScaleDevice: false, selectedItem: null, targetWarehouse: '', showFields: false,
    quantitySource: 'manual', showPrinterSettings: true, printerLocked: false, selectedPrinter: 'zebra' };
  const screen = { state, control, operator, role: 'material_taminotchi', controlOnly: true, orderLocked: false,
    order: { loading: false, error: null, orders: [] }, orderStore: {}, session: {}, orderPicker: () => ({}), itemPicker: () => ({}),
    warehousePicker: () => ({}), defaultWarehousePicker: () => ({}) };
  let picker; const actions = { pick(value) { picker = value; }, devices() {}, chooseApparatus: async () => null, archive() {}, confirmArchivePrint() {} };
  const rows = gscaleDashboardSections(screen, 'control', actions).flatMap(group => group.rows);
  rows.find(row => row.label === 'Printer').press(); return () => picker;
}
test('only opted-in Material hides GoDEX; default GScale printer options are unchanged', async () => {
  const restricted = fixture(true)(), normal = fixture(false)();
  assert.deepEqual((await restricted.load('', 0, 50)).map(item => item.title), ['Zebra']);
  assert.deepEqual((await normal.load('', 0, 50)).map(item => item.title), ['Zebra', 'GoDEX']);
});
