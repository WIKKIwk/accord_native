import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { RoleProfileButton } from '../shared/navigation/RoleHeaderButton';
import type { AdminProfileActionProps } from './AdminProfileActionTypes';
import { useAdminProfileAction } from './useAdminProfileAction';

export function AdminProfileAction(props: AdminProfileActionProps) {
  const model = useAdminProfileAction(props);
  const { colors } = useBaseTheme();
  if (!model.current() || !model.state.valid) return null;

  return <RoleProfileButton label={model.label} hint={model.hint} testID="admin-profile-account-action"
    tintColor={Platform.OS === 'ios' ? colors.onSurface : colors.onSurfaceVariant}
    onPress={model.press} onLongPress={model.hold}>
    {model.state.uri ? <Image source={{ uri: model.state.uri }} contentFit="cover" cachePolicy="memory" style={styles.avatar} /> : null}
  </RoleProfileButton>;
}

const styles = StyleSheet.create({ avatar: { width: 32, height: 32, borderRadius: 16 } });
