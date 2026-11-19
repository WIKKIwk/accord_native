import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAdminShellTheme } from './useAdminShellTheme';
import { useAdminCreateHubScaffoldLayout } from './AdminCreateHubProvider';
import { AdminItemCreateHeader } from './AdminItemCreateHeader.ios';
import { AdminItemCreateList } from './AdminItemCreateList.ios';
import { AdminItemCreateOverlays } from './AdminItemCreateOverlays.ios';
import { AdminItemCreatePrimaryAction } from './AdminItemCreatePrimaryAction.ios';
import { AdminItemCreateScaffold } from './AdminItemCreateScaffold';
import { AdminItemCreateSourceScene } from './AdminItemCreateSourceScene';
import type { AdminItemCreateScreenAssemblyProps } from './AdminItemCreateScreenAssemblyTypes';
import { AdminTopNoticeHost } from './AdminTopNoticeHost';
import { useAdminShellInlineSafeArea } from './AdminShellInlineSafeArea';
import { useAdminItemCreate } from './useAdminItemCreate';
import { useAdminItemCreateNoticePresentation } from './useAdminItemCreateNoticePresentation';
import type { AdminTopNoticeScaffoldBinding } from './useAdminTopNoticeScaffold';

function OwnedScreen({ scaffold, footerPlacement, ...props }: AdminItemCreateScreenAssemblyProps & Readonly<{ scaffold: AdminTopNoticeScaffoldBinding; footerPlacement: 'screen' | 'source' }>) {
  const sourceLayout = useAdminCreateHubScaffoldLayout();
  const { chromeBackground } = useAdminShellTheme(), insets = useAdminShellInlineSafeArea(), model = useAdminItemCreate(props);
  useAdminItemCreateNoticePresentation(model, scaffold.messenger, props.fixedSnackBars);
  if (!model.current() || !model.state.form.valid || !model.state.list.valid) return null;
  return <View style={[styles.screen, { backgroundColor: chromeBackground }]} testID="admin-item-create-screen">
    <Stack.Screen options={{ headerStyle: { backgroundColor: chromeBackground }, contentStyle: { backgroundColor: chromeBackground } }} />
    <AdminItemCreateHeader model={model} props={props} /><View style={styles.headerBottom} />
    <AdminTopNoticeHost scaffold={scaffold} inlineInsets={insets.inlineInsets} dismissLabel={props.topNoticeDismissLabel} />
    <AdminItemCreateScaffold>{bottomPadding => <AdminItemCreateList model={model} bottomPadding={bottomPadding} />}</AdminItemCreateScaffold>
    {footerPlacement === 'screen' ? <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View> : null}<AdminItemCreatePrimaryAction model={model} render={props.renderPrimaryAction} />
    {props.fixedSnackBars.render({ scaffold, sourceLayout, isCurrent: model.current })}<AdminItemCreateOverlays model={model} />
  </View>;
}
/** @v2 AdminItemCreateScreen */
export function AdminItemCreateScreen(props: AdminItemCreateScreenAssemblyProps) {
  return <AdminItemCreateSourceScene screen={props} render={(screen, scaffold, footerPlacement) => <OwnedScreen {...screen} scaffold={scaffold} footerPlacement={footerPlacement} />} />;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, headerBottom: { height: 3 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
