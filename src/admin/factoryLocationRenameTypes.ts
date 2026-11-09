import type { FactoryLocationTicket } from './factoryLocationController';

/** The owner hosts a real dismissible dialog and preserves its original edit ticket. */
export type FactoryLocationRenameProps = {
  ticket: FactoryLocationTicket;
  /** Close the dialog synchronously, then start and handle the guarded rename. */
  onSubmit: (ticket: FactoryLocationTicket, name: string) => void;
  onCancel: () => void;
};
