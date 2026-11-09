import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Stack } from 'expo-router';
import { CustomerDrawer } from './CustomerDrawer';

export function CustomerShell() {
  const colors = useMaterialColors();
  return <CustomerDrawer><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceContainerLow } }} /></CustomerDrawer>;
}
