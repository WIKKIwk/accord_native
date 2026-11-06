import { Alert } from 'react-native';
import { localizedGetter } from '../localization';
import { localeController } from '../localization/runtime';

/** @v2 showLogoutPrompt */
export function confirmRoleDrawerLogout(onLogout: () => void) {
  const t = (key: string) => localizedGetter(key, localeController.locale);
  Alert.alert(t('logoutTitle'), t('logoutPrompt'), [
    { text: t('no'), style: 'cancel' },
    { text: t('yes'), onPress: onLogout },
  ], { cancelable: true });
}
