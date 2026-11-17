import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellNotice } from '../admin/AdminShellNoticeProvider';
import { AdminShellBodyFrame } from '../admin/AdminShellBodyFrame';
import { AdminShellProfileAction } from '../admin/AdminShellProfileAction';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { BrigaderBottomBar } from './BrigaderBottomBar.ios';
import { useBrigaderFeature, type BrigaderFeatureFrameProps } from './BrigaderFeatureContext';

export function BrigaderFeatureFrame(props: BrigaderFeatureFrameProps) {
  const page = useBrigaderFeature(props.route), { colors } = useBaseTheme(), drawer = useRoleDrawer(), notice = useAdminShellNotice();
  if (!page.current()) return null;
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerHigh }}><Stack.Screen options={{ headerShown: true, title: props.title, headerBackVisible: false,
    headerStyle: { backgroundColor: colors.surfaceContainerHigh }, headerLargeTitle: false,
    headerLeft: () => <RoleHeaderButton icon={props.drawer ? 'menu' : 'back'} label={page.backLabel} tintColor={colors.onSurface} onPress={() => { if (page.interactive()) { if (props.drawer) drawer.open(); else (props.onBack ?? page.back)(); } }} />,
    headerRight: () => <View style={{ flexDirection: 'row', alignItems: 'center' }}>{props.actions}{!props.hideProfile ? <AdminShellProfileAction /> : null}</View> }} />
    {notice.topNotice}
    <AdminShellBodyFrame hasFooter testID="brigader-feature-body">{props.children}</AdminShellBodyFrame>
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{props.footer ?? <BrigaderBottomBar active="home" />}</View>
  </View>;
}
