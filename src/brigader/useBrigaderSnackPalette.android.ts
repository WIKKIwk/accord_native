import { useBaseTheme } from '../components/useBaseTheme';
export function useBrigaderSnackPalette() {
  const { colors } = useBaseTheme();
  return { inverseSurface: colors.inverseSurface, onInverseSurface: colors.inverseOnSurface };
}
