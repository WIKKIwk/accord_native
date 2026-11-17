import { useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView, type EdgeInsets } from 'react-native-safe-area-context';
import type { AdminTopNoticeInlineInsets } from './AdminTopNoticeTypes';
import { useAdminShellSourceWindowLayout, type AdminShellSourceWindowLayoutFacts } from './AdminShellSourceWindowLayoutContext';

type InlineSafeArea = Readonly<{ sourceWindow: boolean; top: number | null; left: number | null; right: number | null; inlineInsets: AdminTopNoticeInlineInsets | null }>;
const inset = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
/** Original-window unknowns stay unknown; inherited Activity values serve legacy placement only. */
export function adminShellInlineSafeArea(scope: AdminShellSourceWindowLayoutFacts | null, legacy: EdgeInsets | null): InlineSafeArea {
  if (scope === null) {
    if (!legacy) throw Error('The genuine legacy SafeArea provider is required');
    return Object.freeze({ sourceWindow: false, top: legacy.top, left: legacy.left, right: legacy.right, inlineInsets: Object.freeze({ left: legacy.left, right: legacy.right }) });
  }
  const top = inset(scope.safeInsets?.top) ? scope.safeInsets.top : null, left = inset(scope.safeInsets?.left) ? scope.safeInsets.left : null,
    right = inset(scope.safeInsets?.right) ? scope.safeInsets.right : null, width = inset(scope.viewportWidth) && scope.viewportWidth > 0 ? scope.viewportWidth : null;
  return Object.freeze({ sourceWindow: true, top, left, right, inlineInsets: left !== null && right !== null && width !== null && width > left + right ? Object.freeze({ left, right, width }) : null });
}
export function useAdminShellInlineSafeArea() {
  return adminShellInlineSafeArea(useAdminShellSourceWindowLayout(), useContext(SafeAreaInsetsContext));
}
/** Header stays mounted while unknown. A genuine original-window scope never invokes native SafeAreaView's inherited provider. */
export function AdminShellInlineSafeArea({ children, testID }: { children: ReactNode; testID?: string }) {
  const scope = useAdminShellSourceWindowLayout();
  if (scope === null) return <SafeAreaView edges={['left', 'right']} testID={testID}>{children}</SafeAreaView>;
  return <View testID={testID} style={{ paddingLeft: inset(scope.safeInsets?.left) ? scope.safeInsets.left : undefined,
    paddingRight: inset(scope.safeInsets?.right) ? scope.safeInsets.right : undefined }}>{children}</View>;
}
