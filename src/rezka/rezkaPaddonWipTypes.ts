import type { AdminApparatus } from '../apparatusApi';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

/** The future host must supply data and catalog loaded under this exact original witness. */
export type RezkaPaddonWipBinding = Readonly<{ owner: RezkaSessionSnapshot; batch: Record<string, unknown>; catalog: readonly AdminApparatus[] }>;
export type RezkaPaddonWipReadOnlyProps = { snapshot: RezkaSessionSnapshot; binding: RezkaPaddonWipBinding };
