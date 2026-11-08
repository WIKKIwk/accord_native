import { Stack } from 'expo-router';
import { RoleDrawerButton } from '../../../shared/navigation/RoleDrawerButton';
export default function MaterialHomeLayout() {
  return <Stack screenOptions={{ headerLeft: ({ canGoBack }) => canGoBack ? null : <RoleDrawerButton label="Material bo‘limlari" />,
    headerBackVisible: true, headerBackButtonDisplayMode: 'minimal' }} />;
}
