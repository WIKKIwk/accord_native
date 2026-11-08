import type { AdminApparatus } from '../apparatusApi';
import type { paddonSnapshotFromJson } from '../paddonModels';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

/** The future host must supply data read under this same captured witness. */
export type RezkaPaddonDetailHeaderProps = { snapshot: RezkaSessionSnapshot; data: ReturnType<typeof paddonSnapshotFromJson>;
  catalog: readonly AdminApparatus[] };
