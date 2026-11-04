import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { AppSettingsProvider } from '../components/AppSettings';

export default function RootLayout() {
  return <AppSettingsProvider><AppNavigation /></AppSettingsProvider>;
}

function AppNavigation() {
  const colors = useWorkerColors();
  useEffect(() => {
    if (Platform.OS === 'android') void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
  return <><StatusBar style="auto" /><Stack screenOptions={{ headerShown: false, contentStyle: Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined }}>
    <Stack.Screen name="sheet/[id]" options={{
      presentation: 'transparentModal',
      animation: 'none',
      contentStyle: { backgroundColor: 'transparent' },
    }} />
  </Stack></>;
}
