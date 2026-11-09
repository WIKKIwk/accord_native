import type { RezkaPaddonDetailBinding } from './rezkaPaddonDetailRead';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

/** Only a binding issued by the guarded detail reader is accepted. */
export type RezkaPaddonDetailHeaderProps = { snapshot: RezkaSessionSnapshot; binding: RezkaPaddonDetailBinding };
