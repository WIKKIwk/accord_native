import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminCreateHubScaffoldLayout } from './AdminCreateHubProvider';
import type { AdminItemCreateDialogPortal } from './AdminItemCreateDialogTypes';
import { AdminItemCreateHeader } from './AdminItemCreateHeader.android';
import { AdminItemCreateList } from './AdminItemCreateList.android';
import { AdminItemCreateOverlays } from './AdminItemCreateOverlays.android';
import { AdminItemCreatePrimaryAction } from './AdminItemCreatePrimaryAction.android';
import { AdminItemCreateScaffold } from './AdminItemCreateScaffold';
import type { AdminItemCreateScreenAssemblyProps } from './AdminItemCreateScreenAssemblyTypes';
import { AdminTopNoticeHost } from './AdminTopNoticeHost';
import { adminItemCreateScreenBoundary, requireAdminItemCreateAndroidPresentation } from './adminItemCreateScreenBoundary';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';
import { useAdminItemCreate } from './useAdminItemCreate';
import { useAdminItemCreateNoticePresentation } from './useAdminItemCreateNoticePresentation';
import { useAdminTopNoticeScaffold } from './useAdminTopNoticeScaffold';

export type AdminItemCreateAndroidScreenProps = AdminItemCreateScreenAssemblyProps & Readonly<{ dialogPortal: AdminItemCreateDialogPortal; windowObserver: AdminPresentationWindowObserver }>;
function OwnedScreen(props: AdminItemCreateAndroidScreenProps) {
  // Both genuine providers must exist before the domain hook can admit reads.
  const sourceLayout = useAdminCreateHubScaffoldLayout(), scaffold = useAdminTopNoticeScaffold(props.sourceScaffoldAncestor);
  const { colors } = useBaseTheme(), insets = useSafeAreaInsets(), model = useAdminItemCreate(props);
  useAdminItemCreateNoticePresentation(model, scaffold.messenger, props.fixedSnackBars);
  if (!model.current() || !model.state.form.valid || !model.state.list.valid) return null;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]} testID="admin-item-create-screen">
    <Stack.Screen options={{ headerShown: false }} />
    <SafeAreaView edges={['left', 'right']} testID="admin-item-create-header-safe-area"><AdminItemCreateHeader model={model} props={props} /><View style={styles.headerBottom} /></SafeAreaView>
    <AdminTopNoticeHost scaffold={scaffold} inlineInsets={{ left: insets.left, right: insets.right }} dismissLabel={props.topNoticeDismissLabel} />
    <AdminItemCreateScaffold>{bottomPadding => <AdminItemCreateList model={model} bottomPadding={bottomPadding} />}</AdminItemCreateScaffold>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View><AdminItemCreatePrimaryAction model={model} render={props.renderPrimaryAction} />
    {props.fixedSnackBars.render({ scaffold, sourceLayout, isCurrent: model.current })}
    <AdminItemCreateOverlays model={model} portal={props.dialogPortal} observer={props.windowObserver} />
  </View>;
}
/** @v2 AdminItemCreateScreen */
export function AdminItemCreateScreen(props: AdminItemCreateAndroidScreenProps) {
  if (!adminItemCreateScreenBoundary(props)) return null;
  requireAdminItemCreateAndroidPresentation(props.dialogPortal, props.windowObserver);
  return <OwnedScreen {...props} />;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, headerBottom: { height: 3 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
