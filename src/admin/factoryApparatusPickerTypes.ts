import type { AdminApparatus } from '../apparatusApi';

/** Hosted in the existing dismissible native sheet; dismissal without confirmation preserves the old selection. */
export type FactoryApparatusPickerProps = {
  apparatus: readonly AdminApparatus[];
  initialSelected: ReadonlySet<string>;
  onConfirm: (selected: Set<string>) => void;
  onCancel: () => void;
};
