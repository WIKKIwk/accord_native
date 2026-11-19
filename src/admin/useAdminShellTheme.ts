import { Platform } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { useOptionalAdminShell } from './AdminShellContext';

export function useAdminShellTheme() {
  const theme = useBaseTheme();
  const framed = useOptionalAdminShell()?.session.profile.role === 'brigader';
  const { colors } = theme;
  const bodyBackground = Platform.OS === 'ios' && !framed ? colors.surface : colors.surfaceContainerLow;
  return { ...theme, framed, bodyBackground, chromeBackground: framed ? colors.surfaceContainerHigh : bodyBackground };
}
