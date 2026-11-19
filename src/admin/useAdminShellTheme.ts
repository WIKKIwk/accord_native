import { Platform } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { useOptionalAdminShell } from './AdminShellContext';

export function useAdminShellTheme() {
  const theme = useBaseTheme();
  const framed = useOptionalAdminShell()?.session.profile.role === 'brigader';
  const { colors } = theme;
  const background = Platform.OS === 'ios' ? colors.surface : colors.surfaceContainerLow;
  return { ...theme, framed, bodyBackground: background, chromeBackground: background };
}
