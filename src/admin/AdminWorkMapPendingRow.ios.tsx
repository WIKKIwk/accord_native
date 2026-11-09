import { ListItem, Text } from '@expo/ui';
import { Image } from '@expo/ui/swift-ui';
import { accessibilityHidden, listRowBackground } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';

type Props = { headline: string; supportingText: string; infoLabel: string; first?: boolean; last?: boolean; onPress: () => void };
export function AdminWorkMapPendingRow({ headline, supportingText, onPress }: Props) {
  const theme = useBaseTheme();
  return <ListItem testID="admin-pending-order-row" onPress={onPress}
    modifiers={[listRowBackground(theme.mode === 'dark' ? '#3D2859' : '#EDE0FF')]}
    leading={<View accessible={false} style={{ width: 68, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.secondaryContainer }}>
      <SymbolView name={{ ios: 'function' }} size={22} tintColor={theme.colors.onSecondaryContainer} accessibilityElementsHidden />
    </View>}
    trailing={<Image systemName="info.circle" modifiers={[accessibilityHidden()]} />} supportingText={supportingText}><Text>{headline}</Text></ListItem>;
}
