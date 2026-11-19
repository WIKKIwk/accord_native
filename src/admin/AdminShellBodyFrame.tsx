import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBaseTheme } from '../components/useBaseTheme';
import { useOptionalAdminShell } from './AdminShellContext';
import { adminShellDefaultContentPadding } from './adminShellLayoutPolicy';
import { useAdminShellLayout } from './useAdminShellLayout';

interface AdminShellBodyFrameProps {
  children: ReactNode;
  hasFooter: boolean;
  testID: string;
  contentPadding?: 'default' | 'none';
}

/** @v2 AppShell
 * The dock reserve belongs outside the body. Keeping children mounted
 * while native viewport facts arrive preserves their original owned reads.
 */
export function AdminShellBodyFrame({ children, hasFooter, testID, contentPadding = 'none' }: AdminShellBodyFrameProps) {
  const layout = useAdminShellLayout(hasFooter), { colors } = useBaseTheme();
  const visible = layout.metricsReady;
  const framed = useOptionalAdminShell()?.session.profile.role === 'brigader';
  const surface = { backgroundColor: colors.surfaceContainerLow };
  const safeAreaStyle = [styles.reserve, visible && !framed && surface];
  const corners = framed ? {
    borderTopLeftRadius: layout.topRadius, borderTopRightRadius: layout.topRadius,
    borderBottomLeftRadius: layout.bottomRadius, borderBottomRightRadius: layout.bottomRadius,
  } : undefined;
  const body =
    <View testID={`${testID}-reserve`} style={[styles.reserve, { marginHorizontal: framed ? layout.horizontalInset : undefined, marginBottom: layout.bottomReserve ?? undefined }]}>
      <View testID={testID} pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} accessibilityState={{ busy: !visible }}
        style={[styles.frame, { ...surface, ...corners, opacity: visible ? 1 : 0 }, contentPadding === 'default' && styles.defaultPadding]}>
        {children}
      </View>
    </View>;
  return layout.sourceWindow ? <View style={[safeAreaStyle, { paddingLeft: layout.safeInsets?.left, paddingRight: layout.safeInsets?.right }]} testID={`${testID}-safe-area`}>{body}</View>
    : <SafeAreaView edges={['left', 'right']} style={safeAreaStyle} testID={`${testID}-safe-area`}>{body}</SafeAreaView>;
}

const styles = StyleSheet.create({ reserve: { flex: 1 }, frame: { flex: 1, overflow: 'hidden' }, defaultPadding: {
  paddingStart: adminShellDefaultContentPadding.start, paddingTop: adminShellDefaultContentPadding.top,
  paddingEnd: adminShellDefaultContentPadding.end, paddingBottom: adminShellDefaultContentPadding.bottom,
} });
