import { Stack } from 'expo-router';
import { RoleDrawerButton } from '../../../shared/navigation/RoleDrawerButton';

export default function HomeLayout() {
  return <Stack screenOptions={{ headerLeft: ({ canGoBack }) => canGoBack ? null : <RoleDrawerButton label="Metalayzer" /> }} />;
}
