import type { QolipCatalogProduct } from './qolipProductsState';
import type { QolipManagedSet, QolipMoldDraft } from './qolipSetsApi';

export type QolipCatalogEditorRequest = {
  kind: 'spec' | 'set' | 'mold' | 'edit'; initialProduct?: QolipCatalogProduct; lockProduct?: boolean;
  closeAfterSave?: boolean; scope?: string; initialSize?: number; initialColor?: string;
  pickerOnly?: boolean;
  allowExisting?: boolean; availablePantonNumber?: number | null; onSave?: (draft: QolipMoldDraft) => Promise<unknown>;
};
export type QolipCatalogEditorState = {
  request: QolipCatalogEditorRequest; code: string; size: string; colors: string[]; pantons: number[];
  warehouse: string | null; warehouses: string[]; warehouseLoading: boolean; warehouseFailed: boolean;
  existing: boolean; product: QolipCatalogProduct | null; picker: 'product' | 'set' | null;
  pickerQuery: string; pickerLoading: boolean; pickerHasMore: boolean; products: readonly QolipCatalogProduct[]; sets: readonly QolipManagedSet[];
  suggestions: readonly QolipManagedSet[]; saving: boolean; error: string | null; expandedCodes: boolean;
  suggestionsLoading: boolean; suggestionsFailed: boolean;
  saved: readonly QolipCatalogProduct[];
};
export type QolipCatalogEditorActions = {
  setCode(value: string): void; setSize(value: string): void; setExisting(value: boolean): void;
  chooseColor(value: string): void; addPanton(): void; setWarehouse(value: string): void;
  loadWarehouses(): void; chooseProduct(): void; chooseSet(): void; pickerQuery(value: string): void;
  pickProduct(product: QolipCatalogProduct): void; reuseSet(entry: QolipManagedSet): void; closePicker(): void;
  toggleCodes(): void; save(): void; close(): void; printSaved(): void;
  allSuggestions(): void; retrySuggestions(): void;
  pickerMore(): void; retryPicker(): void;
};
export type QolipCatalogFormProps = { state: QolipCatalogEditorState; actions: QolipCatalogEditorActions; canSave: boolean };
export const qolipCatalogColors = ['#E53935','#FB8C00','#FDD835','#43A047','#00ACC1','#1E88E5','#3949AB','#8E24AA',
  '#D81B60','#6D4C41','#D4A72C','#757575','#B7BCC2','#C7CDD3','#212121','#FFFFFF'];
export function qolipPantonNumber(value: string): number | null {
  const match = /^PANTON\s+([1-9]\d*)$/.exec(value.trim().toUpperCase()), number = match ? Number(match[1]) : 0;
  return number > 0 && number <= 100 ? number : null;
}
