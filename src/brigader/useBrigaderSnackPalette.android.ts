import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useBaseTheme } from '../components/useBaseTheme';
export function useBrigaderSnackPalette() { const theme = useBaseTheme(), colors = useMaterialColors({ colorScheme: theme.mode, seedColor: theme.seed }); return { inverseSurface: colors.inverseSurface, onInverseSurface: colors.inverseOnSurface }; }
