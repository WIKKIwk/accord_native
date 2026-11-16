import type { AdminApparatus } from '../apparatusApi';
import type { FactoryDialog, FactoryLocationPresentation } from './factoryLocationPresentation';

export function factoryLocationDialogProps(dialog: FactoryDialog, presentation: FactoryLocationPresentation, apparatus: readonly AdminApparatus[]) {
  return { ticket: dialog.ticket, apparatus,
    openPicker: (selected: Set<string>) => presentation.picker(dialog, selected),
    showInvalidName: (message: string) => presentation.invalidName(dialog, message),
    onCancel: () => presentation.cancel(dialog),
    onSubmit: (_ticket: typeof dialog.ticket, name: string, selected?: Set<string>) => presentation.submit(dialog, name, selected),
  };
}
