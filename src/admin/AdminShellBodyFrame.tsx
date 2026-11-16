import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { adminShellDefaultContentPadding } from './adminShellLayoutPolicy';
import { useAdminShellLayout } from './useAdminShellLayout';

interface AdminShellBodyFrameProps {
  children: ReactNode;
  hasFooter: boolean;
  testID: string;
  contentPadding?: 'default' | 'none';
}

/** @v2 AppShell
 * The dock reserve belongs outside the clipped body. Keeping children mounted
 * while native viewport facts arrive preserves their original owned reads.
 */
export function AdminShellBodyFrame({ children, hasFooter, testID, contentPadding = 'none' }: AdminShellBodyFrameProps) {
  const layout = useAdminShellLayout(hasFooter), { colors } = useBaseTheme();
  return <View testID={`${testID}-reserve`} style={[styles.reserve, { marginHorizontal: layout.horizontalInset, marginBottom: layout.bottomReserve ?? undefined }]}>
    <View testID={testID} pointerEvents={layout.metricsReady ? 'auto' : 'none'} accessibilityElementsHidden={!layout.metricsReady}
      importantForAccessibility={layout.metricsReady ? 'auto' : 'no-hide-descendants'} accessibilityState={{ busy: !layout.metricsReady }}
      style={[styles.frame, { backgroundColor: colors.surfaceContainerLow, borderTopLeftRadius: layout.topRadius, borderTopRightRadius: layout.topRadius,
        borderBottomLeftRadius: layout.bottomRadius, borderBottomRightRadius: layout.bottomRadius, opacity: layout.metricsReady ? 1 : 0 }, contentPadding === 'default' && styles.defaultPadding]}>
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({ reserve: { flex: 1 }, frame: { flex: 1, overflow: 'hidden' }, defaultPadding: {
  paddingStart: adminShellDefaultContentPadding.start, paddingTop: adminShellDefaultContentPadding.top,
  paddingEnd: adminShellDefaultContentPadding.end, paddingBottom: adminShellDefaultContentPadding.bottom,
} });
