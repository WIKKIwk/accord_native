import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { AppSettingsProvider } from '../components/AppSettings';
import { useBaseTheme } from '../components/useBaseTheme';

export default function RootLayout() {
  return <AppSettingsProvider><AppNavigation /></AppSettingsProvider>;
}

function AppNavigation() {
  const theme = useBaseTheme();
  const background = theme.colors.surfaceContainerLow ?? theme.colors.surface ?? (theme.mode === 'dark' ? '#000000' : '#ffffff');
  useEffect(() => {
    if (Platform.OS === 'android') void SystemUI.setBackgroundColorAsync(background);
  }, [background]);
  const nativeTheme = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
  return <ThemeProvider value={{ ...nativeTheme, colors: { ...nativeTheme.colors, background, card: theme.colors.surface ?? background,
    primary: theme.colors.primary ?? theme.seed, text: theme.colors.onSurface ?? nativeTheme.colors.text,
    border: theme.colors.outlineVariant ?? nativeTheme.colors.border } }}><View style={{ flex: 1, direction: theme.direction === 'rightToLeft' ? 'rtl' : 'ltr' }}>
    <StatusBar style="auto" /><Stack screenOptions={{ headerShown: false, contentStyle: Platform.OS === 'android' ? { backgroundColor: background } : undefined }}>
    <Stack.Screen name="sheet/[id]" options={{
      presentation: 'transparentModal',
      animation: 'none',
      contentStyle: { backgroundColor: 'transparent' },
    }} />
  </Stack></View></ThemeProvider>;
}
