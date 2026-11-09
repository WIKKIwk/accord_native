import type { RezkaPaddonDetailBinding } from './rezkaPaddonDetailRead';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

export type RezkaPaddonWipReadOnlyProps = { snapshot: RezkaSessionSnapshot; binding: RezkaPaddonDetailBinding; index: number };
