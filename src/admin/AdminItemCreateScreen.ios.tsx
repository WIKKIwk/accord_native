import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminCreateHubScaffoldLayout } from './AdminCreateHubProvider';
import { AdminItemCreateHeader } from './AdminItemCreateHeader.ios';
import { AdminItemCreateList } from './AdminItemCreateList.ios';
import { AdminItemCreateOverlays } from './AdminItemCreateOverlays.ios';
import { AdminItemCreatePrimaryAction } from './AdminItemCreatePrimaryAction.ios';
import { AdminItemCreateScaffold } from './AdminItemCreateScaffold';
import type { AdminItemCreateScreenAssemblyProps } from './AdminItemCreateScreenAssemblyTypes';
import { AdminTopNoticeHost } from './AdminTopNoticeHost';
import { useAdminShellInlineSafeArea } from './AdminShellInlineSafeArea';
import { adminItemCreateScreenBoundary } from './adminItemCreateScreenBoundary';
import { useAdminItemCreate } from './useAdminItemCreate';
import { useAdminItemCreateNoticePresentation } from './useAdminItemCreateNoticePresentation';
import { useAdminTopNoticeScaffold } from './useAdminTopNoticeScaffold';

function OwnedScreen(props: AdminItemCreateScreenAssemblyProps) {
  const sourceLayout = useAdminCreateHubScaffoldLayout(), scaffold = useAdminTopNoticeScaffold(props.sourceScaffoldAncestor);
  const { colors } = useBaseTheme(), insets = useAdminShellInlineSafeArea(), model = useAdminItemCreate(props);
  useAdminItemCreateNoticePresentation(model, scaffold.messenger, props.fixedSnackBars);
  if (!model.current() || !model.state.form.valid || !model.state.list.valid) return null;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]} testID="admin-item-create-screen">
    <Stack.Screen options={{ headerStyle: { backgroundColor: colors.surfaceContainerHigh }, contentStyle: { backgroundColor: colors.surfaceContainerHigh } }} />
    <AdminItemCreateHeader model={model} props={props} /><View style={styles.headerBottom} />
    <AdminTopNoticeHost scaffold={scaffold} inlineInsets={insets.inlineInsets} dismissLabel={props.topNoticeDismissLabel} />
    <AdminItemCreateScaffold>{bottomPadding => <AdminItemCreateList model={model} bottomPadding={bottomPadding} />}</AdminItemCreateScaffold>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View><AdminItemCreatePrimaryAction model={model} render={props.renderPrimaryAction} />
    {props.fixedSnackBars.render({ scaffold, sourceLayout, isCurrent: model.current })}<AdminItemCreateOverlays model={model} />
  </View>;
}
/** @v2 AdminItemCreateScreen */
export function AdminItemCreateScreen(props: AdminItemCreateScreenAssemblyProps) {
  return adminItemCreateScreenBoundary(props) ? <OwnedScreen {...props} /> : null;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, headerBottom: { height: 3 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
