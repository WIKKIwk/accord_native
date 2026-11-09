import { Host, LinearProgressIndicator } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';

// V2 AppShell.appBarBottomLoading; no value means the operation is indeterminate.
export function RawSplitBusy() {
  return <Host style={{ width: '100%', height: 3 }}><LinearProgressIndicator modifiers={[fillMaxWidth(), height(3)]} /></Host>;
}
