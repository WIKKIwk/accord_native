import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { isSessionWitnessCurrent } from '../../auth';
import { useIsFocused, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../components/ProfileScreen';
import { RoleHeader } from '../../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../../shared/navigation/roleDrawerContext';
import { BoyoqchiDock } from '../../boyoqchi/BoyoqchiDock.android';
import { BoyoqchiMessage } from '../../boyoqchi/BoyoqchiMessage';
import { BOYOQCHI_DEMO_UNAVAILABLE } from '../../boyoqchi/returnedPaintDemoGuard';
import { useBoyoqchiContext } from '../../boyoqchi/BoyoqchiContext';
import { registerBoyoqchiProfileNavigation } from '../../boyoqchi/boyoqchiProfileNavigation';
import { useBoyoqchiGetter, useBoyoqchiText } from '../../boyoqchi/useBoyoqchiText';
export default function BoyoqchiProfile() {
  const { session, witness, onLogout, profileNavigation } = useBoyoqchiContext(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const drawer = useRoleDrawer(), getter = useBoyoqchiGetter(), t = useBoyoqchiText();
  const isCurrent = useCallback(() => witness.session === session && isSessionWitnessCurrent(witness) &&
    session.token !== 'test-mode-token', [session, witness]);
  const navigation = useNavigation('/android-boyoqchi'), navigationRef = useRef(navigation), focused = useIsFocused();
  useLayoutEffect(() => { navigationRef.current = navigation; }, [navigation]);
  useLayoutEffect(() => {
    if (!focused) return;
    return registerBoyoqchiProfileNavigation(profileNavigation, action => navigationRef.current.dispatch(action),
      () => isSessionWitnessCurrent(witness));
  }, [focused, profileNavigation, session, witness]);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={getter('profileTitle')} navigation={{ icon: 'menu', label: t('Bo‘yoqchi bo‘limlari'), onPress: drawer.open }} />
    <View style={{ flex: 1 }}>{session.token === 'test-mode-token' ? <BoyoqchiMessage title={BOYOQCHI_DEMO_UNAVAILABLE} error />
      : <ProfileScreen session={session} onLogout={onLogout} showDirectLogout={false} isCurrent={isCurrent}
        settingsUnavailableMessage={t('Sozlamalar hozircha mavjud emas.')} />}</View>
    <BoyoqchiDock active="profile" />
  </View>;
}
