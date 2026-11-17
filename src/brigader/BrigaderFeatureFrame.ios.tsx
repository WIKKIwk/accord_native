import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  return <View style={{ flex: 1, backgroundColor: props.backgroundColor??colors.surfaceContainerHigh }}><Stack.Screen options={{ headerShown: !props.header, title: props.title, headerBackVisible: false,
    headerStyle: { backgroundColor: props.backgroundColor??colors.surfaceContainerHigh }, headerLargeTitle: false,headerTintColor:props.foregroundColor??colors.onSurface,
    headerLeft: () => <RoleHeaderButton icon={props.drawer ? 'menu' : 'back'} label={page.backLabel} tintColor={props.foregroundColor??colors.onSurface} onPress={() => { if (page.interactive()) { if (props.drawer) drawer.open(); else (props.onBack ?? page.back)(); } }} />,
    headerRight: () => <View style={{ flexDirection: 'row', alignItems: 'center' }}>{props.actions}{!props.hideProfile ? <AdminShellProfileAction /> : null}</View> }} />
    {props.header?<SafeAreaView edges={['top']}>{props.header}</SafeAreaView>:null}
    {notice.topNotice}
    <View style={{flex:1}}>{props.plainBody?props.children:<AdminShellBodyFrame hasFooter={!props.hideFooter} testID="brigader-feature-body">{props.children}</AdminShellBodyFrame>}</View>
    {!props.hideFooter?<View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{props.footer ?? <BrigaderBottomBar active="home" />}</View>:null}
  </View>;
}
