import { Host, ProgressView } from '@expo/ui/swift-ui';

// V2 AppShell.appBarBottomLoading; SwiftUI draws its native indeterminate indicator.
export function RawSplitBusy() {
  return <Host style={{ width: '100%', height: 24 }} alignment="center"><ProgressView /></Host>;
}
