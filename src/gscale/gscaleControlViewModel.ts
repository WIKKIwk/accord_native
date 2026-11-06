import { canPressScaleBatchAction, canTriggerGrossPrint, hasExactRpsBatchContext, normalizePrinterChoice,
  normalizeQuantitySource, parseManualDuplicateCount, parsePositiveKg, parseScaleDisplayKg } from './gscaleControlLogic';
import { isTayyorlovSimpleWarehouse } from './gscalePreparation';
import type { GScaleBatchSession } from './gscaleBatchModel';
import type { MonitorSnapshot } from './gscaleMonitor';
import type { OperatorControlDraft } from './gscaleDraft';
import type { PrintTransport } from '../printing/printTransport';

export type GScaleControlInputs = { controlOnly: boolean; freshForm: boolean; role: string; linkedOrderWidthMm: number | null;
  materialWarehouses: string[]; transport: PrintTransport; hasServer: boolean; hasOfflinePrinter: boolean; hasBluetoothPrinter: boolean;
  batchResolved: boolean; batch: GScaleBatchSession | null; batchContextEditing: boolean; draftContextSaved: boolean;
  usesReceiptOrderContext: boolean; preparationPresetLoading: boolean; manualPrintLoading: boolean; batchActionLoading: boolean;
  simpleReceiptLoading: boolean; requestInFlight: boolean; draft: OperatorControlDraft; snapshot: MonitorSnapshot };

/** Values calculated by _buildControlSection in V2. */
export function gscaleControlViewModel(input: GScaleControlInputs) {
  const { draft, snapshot } = input;
  const hasScaleDevice = input.hasServer, hasPrintDevice = input.transport !== 'wifi' || hasScaleDevice;
  const showPrinterSettings = !input.controlOnly || (input.transport === 'wifi' && input.hasServer) ||
    (input.transport === 'offline' && input.hasOfflinePrinter);
  const active = input.batchResolved && input.batch?.active ? input.batch : null;
  const editing = !!active && input.batchContextEditing;
  const draftSummary = !active && input.draftContextSaved && !input.batchContextEditing;
  const showFields = !active ? !draftSummary : editing;
  const lockedContext = !!active && !editing;
  const selected = !active || editing
    ? (draft.item_code ? { code: draft.item_code, name: draft.item_name, requiresDimensions: draft.item_requires_dimensions } : null)
    : { code: active.item_code, name: active.item_name, requiresDimensions: active.width_mm != null || active.micron != null };
  const selectedWarehouse = !active || editing ? draft.warehouse : active.warehouse;
  const defaultMode = !active && draft.warehouse_mode === 'default';
  const warehouse = defaultMode ? draft.default_warehouse : selectedWarehouse;
  const simple = !active && isTayyorlovSimpleWarehouse(input.controlOnly, input.freshForm, input.role, warehouse, input.materialWarehouses);
  const fieldsLocked = (!!active && !editing) || (input.usesReceiptOrderContext && !input.batchResolved) ||
    input.preparationPresetLoading || input.batchActionLoading || input.manualPrintLoading || input.simpleReceiptLoading;
  const quantitySource = simple ? 'manual' : normalizeQuantitySource(lockedContext ? active!.quantity_source : draft.quantity_source);
  const babina = simple ? false : lockedContext ? active!.tare_enabled : draft.babina_enabled;
  const manualQty = quantitySource === 'manual' ? parsePositiveKg(draft.manual_qty_text) : null;
  const duplicateCount = quantitySource === 'manual' ? parseManualDuplicateCount(draft.manual_duplicate_text) : 1;
  const width = parsePositiveKg(draft.width_text), micron = parsePositiveKg(draft.micron_text), length = parsePositiveKg(draft.length_text);
  const dimensionsReady = !selected?.requiresDimensions || (width != null && micron != null);
  const hasPrintSelection = !simple && selected != null && !!warehouse && dimensionsReady && length != null;
  const exact = hasExactRpsBatchContext(active);
  const saveEnabled = showFields && (!active || exact) && hasPrintSelection &&
    !input.batchActionLoading && !input.manualPrintLoading && !input.requestInFlight;
  const scaleActionEnabled = canPressScaleBatchAction(hasPrintSelection, snapshot.batchActive, input.manualPrintLoading,
    input.batchActionLoading) && hasScaleDevice && input.batchResolved && (!snapshot.batchActive || exact);
  const manualStartEnabled = hasPrintSelection && hasPrintDevice && !snapshot.batchActive && !input.manualPrintLoading &&
    !input.batchActionLoading && !input.requestInFlight && input.batchResolved;
  const manualStopEnabled = !!active && exact && quantitySource === 'manual' && !input.manualPrintLoading &&
    !input.batchActionLoading && !input.requestInFlight;
  const manualPrintReady = canTriggerGrossPrint(parsePositiveKg(draft.manual_qty_text), babina, draft.babina_text);
  const manualPrintEnabled = hasPrintDevice && quantitySource === 'manual' && manualPrintReady &&
    !input.manualPrintLoading && !input.batchActionLoading && !input.batchContextEditing;
  const simpleReady = simple && selected != null && !!warehouse.trim() && manualQty != null && !input.simpleReceiptLoading;
  const scaleQty = parseScaleDisplayKg(snapshot.scaleValue);
  let widthRangeError: string | null = null;
  if (input.role !== 'tayyorlov_masteri' && width != null && input.linkedOrderWidthMm != null &&
      Number.isFinite(input.linkedOrderWidthMm) && input.linkedOrderWidthMm > 0) {
    const min = input.linkedOrderWidthMm - 10, max = input.linkedOrderWidthMm + 40;
    if (width < min || width > max) widthRangeError = `Diapazondan chiqdi (${min}–${max} mm)`;
  }
  return { hasScaleDevice, hasPrintDevice, showPrinterSettings, activeBatch: active, showFields, draftSummary,
    fieldsLocked, printerLocked: snapshot.batchActive || input.batchActionLoading || input.manualPrintLoading,
    selectedItem: selected, selectedWarehouse, targetWarehouse: warehouse, simpleReceiptMode: simple,
    quantitySource, babinaEnabled: babina, manualQty, duplicateCount, width, micron, length, widthRangeError,
    manualQtyInvalid: quantitySource === 'manual' && !!draft.manual_qty_text.trim() && manualQty == null,
    duplicateInvalid: quantitySource === 'manual' && !!draft.manual_duplicate_text.trim() && duplicateCount == null,
    babinaInvalid: babina && !!draft.babina_text.trim() && parsePositiveKg(draft.babina_text) == null,
    widthInvalid: selected?.requiresDimensions === true && !!draft.width_text.trim() && width == null,
    micronInvalid: selected?.requiresDimensions === true && !!draft.micron_text.trim() && micron == null,
    lengthInvalid: selected != null && !!draft.length_text.trim() && length == null,
    hasPrintSelection, saveEnabled, scaleActionEnabled, manualStartEnabled, manualStopEnabled, manualPrintEnabled, simpleReady,
    scalePrintReady: canTriggerGrossPrint(scaleQty, babina, draft.babina_text), selectedPrinter: normalizePrinterChoice(draft.printer) };
}
