import { QolipHomeGrid } from './QolipHomeGrid';
import type { QolipHomeBlockBodyProps } from './qolipHomeBlockBodyProps';
import { useQolipHomeBlockRead } from './useQolipHomeBlockRead';

// Unwired body adapter, not a Home owner or route. Real guarded actions and an original-session boundary are mandatory.
export function QolipHomeBlockBody(props: QolipHomeBlockBodyProps) {
  const state = useQolipHomeBlockRead(props.blockKey, props.future, props.initialLocations, props.boundary);
  if (state.invalid) return null;
  return <QolipHomeGrid locations={state.locations} loading={state.loading} error={state.error}
    searchCounts={props.searchCounts}
    refresh={async () => { if (state.controller.canAct()) await props.refresh(); }}
    openCell={(...args) => { if (state.controller.canAct()) props.openCell(...args); }}
    printCell={(...args) => { if (state.controller.canAct()) props.printCell(...args); }} />;
}
