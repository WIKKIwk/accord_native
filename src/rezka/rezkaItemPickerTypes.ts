import type { Session } from '../auth';
import type { SupplierItem } from '../shared/catalogApi';
export type RezkaItemPickerProps = { session: Session; scope: string; select(item: SupplierItem): void };
