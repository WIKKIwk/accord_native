import { IconButton, RNHostView, TopAppBar } from '@expo/ui/jetpack-compose';
import { height, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellNotice } from '../admin/AdminShellNoticeProvider';
import { AdminShellBodyFrame } from '../admin/AdminShellBodyFrame';
import { AdminShellProfileAction } from '../admin/AdminShellProfileAction';
import { AdminText } from '../admin/AdminTypography.android';
import { SymbolView } from 'expo-symbols';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { BrigaderBottomBar } from './BrigaderBottomBar.android';
import { useBrigaderFeature, type BrigaderFeatureFrameProps } from './BrigaderFeatureContext';

export function BrigaderFeatureFrame(props: BrigaderFeatureFrameProps) {
  const page = useBrigaderFeature(props.route), { colors } = useBaseTheme(), drawer = useRoleDrawer(), notice = useAdminShellNotice();
  if (!page.current()) return null;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: props.backgroundColor??colors.surfaceContainerHigh }}>
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><TopAppBar windowInsets={{}} colors={{ containerColor: props.backgroundColor??colors.surfaceContainerHigh }} modifiers={[height(60)]}>
      <TopAppBar.NavigationIcon><IconButton onClick={() => { if (page.interactive()) { if (props.drawer) drawer.open(); else (props.onBack ?? page.back)(); } }} modifiers={[semantics({ contentDescription: page.backLabel })]}>
        <RNHostView matchContents><SymbolView name={{ android: props.drawer ? 'menu' : 'arrow_back' }} size={24} tintColor={props.foregroundColor??colors.onSurface} /></RNHostView>
      </IconButton></TopAppBar.NavigationIcon>
      <TopAppBar.Title><AdminText color={props.foregroundColor} style={{ fontSize: 24, fontWeight: '800' }} maxLines={1}>{props.title}</AdminText></TopAppBar.Title>
      <TopAppBar.Actions><RNHostView matchContents><View style={{ flexDirection: 'row', alignItems: 'center' }}>{props.actions}{!props.hideProfile ? <AdminShellProfileAction /> : null}</View></RNHostView></TopAppBar.Actions>
    </TopAppBar></BaseHost>
    {notice.topNotice}
    <View style={{flex:1}}>{props.plainBody?props.children:<AdminShellBodyFrame hasFooter={!props.hideFooter} testID="brigader-feature-body">{props.children}</AdminShellBodyFrame>}</View>
    {!props.hideFooter?<View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{props.footer ?? <BrigaderBottomBar active="home" />}</View>:null}
  </SafeAreaView>;
}
