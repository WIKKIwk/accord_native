import type { RezkaSessionSnapshot } from './rezkaSessionGuard';
import type { SupplierItem } from '../shared/catalogApi';
export type RezkaItemPickerProps = { snapshot: RezkaSessionSnapshot; select(item: SupplierItem): void };
