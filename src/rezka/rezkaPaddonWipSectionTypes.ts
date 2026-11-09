import type { AdminApparatus } from '../apparatusApi';
import type { paddonSnapshotFromJson } from '../paddonModels';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

/** The future host must supply a detail snapshot and catalog read under the same witness. */
export type RezkaPaddonWipSectionBinding = Readonly<{ owner: RezkaSessionSnapshot; data: ReturnType<typeof paddonSnapshotFromJson>;
  catalog: readonly AdminApparatus[] }>;
export type RezkaPaddonWipSectionProps = { snapshot: RezkaSessionSnapshot; binding: RezkaPaddonWipSectionBinding };
