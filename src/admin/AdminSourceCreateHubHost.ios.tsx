import { StyleSheet, View } from 'react-native';
import { AdminCreateHubHost } from './AdminCreateHubHost.ios';
import type { AdminSourceDockScaffoldOwner } from './AdminSourceDockScaffoldOwner';
import { useAdminSourceCreateHubPlacement } from './useAdminSourceCreateHubPlacement';

/** Local native controls/marker bootstrap only. A local ACK never makes the missing global overlay host available. */
export function AdminSourceCreateHubHost({ source }: { source: AdminSourceDockScaffoldOwner }) {
  const { presentation, marker, labels } = useAdminSourceCreateHubPlacement(source);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.held} testID="admin-source-hub-local-held">
    {presentation ? <AdminCreateHubHost controller={presentation.controller} state={presentation.state} primary={presentation.primary} layout={presentation.sizing} labels={labels} slot="primary" primaryMarker={marker} /> : null}
  </View>;
}
const styles = StyleSheet.create({ held: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 } });
