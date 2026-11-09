import { localizedGetter } from '../shared/localization';
import type { SupplierItem } from '../shared/catalogApi';
import type { SupplierDirectoryEntry } from './werkaDirectoryApi';

/** Unwired content only. Its owner must provide account-safe pickers and submission. */
export type WerkaUnannouncedContentProps = {
  supplier: Pick<SupplierDirectoryEntry, 'ref' | 'name'> | null;
  item: Pick<SupplierItem, 'code' | 'name' | 'uom'> | null;
  initialQuantity: string;
  /** Change only for a programmatic quantity reset, not for each keystroke. */
  quantityFieldKey: string | number;
  submitting: boolean;
  locale: string;
  onPickSupplier: () => void;
  onPickItem: () => void;
  onQuantityChange: (value: string) => void;
  onRequestSubmit: () => void;
};

export function werkaUnannouncedPresentation(props: WerkaUnannouncedContentProps) {
  const t = (key: string) => localizedGetter(key, props.locale);
  return {
    supplierLabel: t('supplierLabel'), itemLabel: t('itemLabel'), quantityLabel: t('amountLabel'),
    supplierName: props.supplier?.name ?? t('selectSupplier'), itemName: props.item?.name ?? t('selectItem'),
    submitLabel: t(props.submitting ? 'pinSaving' : 'confirmTitle'),
    showItem: props.supplier !== null, showQuantity: props.item !== null,
    canPickSupplier: !props.submitting, canPickItem: props.supplier !== null && !props.submitting,
    canSubmit: props.supplier !== null && props.item !== null && !props.submitting,
  };
}
