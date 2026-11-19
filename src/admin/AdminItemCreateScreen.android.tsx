import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAdminShellTheme } from './useAdminShellTheme';
import { useAdminCreateHubScaffoldLayout } from './AdminCreateHubProvider';
import type { AdminItemCreateDialogPortal } from './AdminItemCreateDialogTypes';
import { AdminItemCreateHeader } from './AdminItemCreateHeader.android';
import { AdminItemCreateList } from './AdminItemCreateList.android';
import { AdminItemCreateOverlays } from './AdminItemCreateOverlays.android';
import { AdminItemCreatePrimaryAction } from './AdminItemCreatePrimaryAction.android';
import { AdminItemCreateScaffold } from './AdminItemCreateScaffold';
import { AdminItemCreateSourceScene } from './AdminItemCreateSourceScene';
import type { AdminItemCreateScreenAssemblyProps } from './AdminItemCreateScreenAssemblyTypes';
import { AdminTopNoticeHost } from './AdminTopNoticeHost';
import { AdminShellInlineSafeArea, useAdminShellInlineSafeArea } from './AdminShellInlineSafeArea';
import { requireAdminItemCreateAndroidPresentation } from './adminItemCreateScreenBoundary';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';
import { useAdminItemCreate } from './useAdminItemCreate';
import { useAdminItemCreateNoticePresentation } from './useAdminItemCreateNoticePresentation';
import type { AdminTopNoticeScaffoldBinding } from './useAdminTopNoticeScaffold';

export type AdminItemCreateAndroidScreenProps = AdminItemCreateScreenAssemblyProps & Readonly<{ dialogPortal: AdminItemCreateDialogPortal; windowObserver: AdminPresentationWindowObserver }>;
function OwnedScreen({ scaffold, footerPlacement, ...props }: AdminItemCreateAndroidScreenProps & Readonly<{ scaffold: AdminTopNoticeScaffoldBinding; footerPlacement: 'screen' | 'source' }>) {
  // Both genuine providers must exist before the domain hook can admit reads.
  const sourceLayout = useAdminCreateHubScaffoldLayout();
  const { chromeBackground } = useAdminShellTheme(), insets = useAdminShellInlineSafeArea(), model = useAdminItemCreate(props);
  useAdminItemCreateNoticePresentation(model, scaffold.messenger, props.fixedSnackBars);
  if (!model.current() || !model.state.form.valid || !model.state.list.valid) return null;
  return <View style={[styles.screen, { backgroundColor: chromeBackground, paddingTop: insets.top ?? undefined }]} testID="admin-item-create-screen">
    <Stack.Screen options={{ headerShown: false }} />
    <AdminShellInlineSafeArea testID="admin-item-create-header-safe-area"><AdminItemCreateHeader model={model} props={props} /><View style={styles.headerBottom} /></AdminShellInlineSafeArea>
    <AdminTopNoticeHost scaffold={scaffold} inlineInsets={insets.inlineInsets} dismissLabel={props.topNoticeDismissLabel} />
    <AdminItemCreateScaffold>{bottomPadding => <AdminItemCreateList model={model} bottomPadding={bottomPadding} />}</AdminItemCreateScaffold>
    {footerPlacement === 'screen' ? <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View> : null}<AdminItemCreatePrimaryAction model={model} render={props.renderPrimaryAction} />
    {props.fixedSnackBars.render({ scaffold, sourceLayout, isCurrent: model.current })}
    <AdminItemCreateOverlays model={model} portal={props.dialogPortal} observer={props.windowObserver} />
  </View>;
}
/** @v2 AdminItemCreateScreen */
export function AdminItemCreateScreen(props: AdminItemCreateAndroidScreenProps) {
  return <AdminItemCreateSourceScene screen={props} validate={validatePresentation} render={(screen, scaffold, footerPlacement) => <OwnedScreen {...screen} scaffold={scaffold} footerPlacement={footerPlacement} />} />;
}
const validatePresentation = (props: AdminItemCreateAndroidScreenProps) => requireAdminItemCreateAndroidPresentation(props.dialogPortal, props.windowObserver);
const styles = StyleSheet.create({ screen: { flex: 1 }, headerBottom: { height: 3 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
