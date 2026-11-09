import type { AdminApparatus } from '../apparatusApi';
import type { FactoryLocationTicket } from './factoryLocationController';

/** The owner hosts a real dismissible dialog and preserves this ticket through picker and save. */
export type FactoryLocationEditorProps = {
  ticket: FactoryLocationTicket;
  apparatus: readonly AdminApparatus[];
  openPicker: (selected: Set<string>) => Promise<ReadonlySet<string> | null>;
  /** Dismiss the dialog synchronously, then start and handle the guarded controller save. */
  onSubmit: (ticket: FactoryLocationTicket, name: string, selected: Set<string>) => void;
  onCancel: () => void;
  showInvalidName: (message: string) => void;
};
