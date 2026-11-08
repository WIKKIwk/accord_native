import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useIsFocused, useNavigation } from 'expo-router';
import { useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../components/ProfileScreen';
import { RoleHeader } from '../../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../../shared/navigation/roleDrawerContext';
import { BoyoqchiDock } from '../../boyoqchi/BoyoqchiDock.android';
import { useBoyoqchiContext } from '../../boyoqchi/BoyoqchiContext';
import { registerBoyoqchiProfileNavigation } from '../../boyoqchi/boyoqchiProfileNavigation';
import { useBoyoqchiGetter, useBoyoqchiText } from '../../boyoqchi/useBoyoqchiText';
export default function BoyoqchiProfile() {
  const { session, onLogout, profileNavigation } = useBoyoqchiContext(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const drawer = useRoleDrawer(), getter = useBoyoqchiGetter(), t = useBoyoqchiText();
  const navigation = useNavigation('/android-boyoqchi'), navigationRef = useRef(navigation), focused = useIsFocused();
  useLayoutEffect(() => { navigationRef.current = navigation; }, [navigation]);
  useLayoutEffect(() => {
    if (!focused) return;
    return registerBoyoqchiProfileNavigation(profileNavigation, action => navigationRef.current.dispatch(action));
  }, [focused, profileNavigation, session]);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={getter('profileTitle')} navigation={{ icon: 'menu', label: t('Bo‘yoqchi bo‘limlari'), onPress: drawer.open }} />
    <View style={{ flex: 1 }}><ProfileScreen session={session} onLogout={onLogout} showDirectLogout={false} /></View>
    <BoyoqchiDock active="profile" />
  </View>;
}
