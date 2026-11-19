import { Stack } from 'expo-router';
import { useBaseTheme } from '../../../components/useBaseTheme';

export default function AdminActivityLayout() {
  const { colors } = useBaseTheme();
  return <Stack screenOptions={{ headerBackVisible: true, headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: colors.surfaceContainerHigh }, headerTintColor: colors.onSurface, headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.surfaceContainerLow } }} />;
}
