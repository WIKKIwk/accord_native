import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { BaseHost } from './BaseHost';
import { useBaseTheme } from './useBaseTheme';
export { WorkerSheetButton as WorkerOrderButton } from './WorkerSheetButton';

export function WorkerOrderBlockingNotice({ message }: { message: string }) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column modifiers={[fillMaxWidth(), clip({ type: 'roundedCorner', radius: 12 }), background(colors.surfaceContainerHighest), paddingAll(12)]}>
      <Text color={colors.onSurfaceVariant ?? colors.onSurface} style={{ typography: 'bodyMedium', fontWeight: '600' }}>{message}</Text>
    </Column>
  </BaseHost>;
}

export function WorkerOrderActionGroup({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 8 }}>
    {Children.toArray(children).map((child, index) => <View key={index} style={{ flex: 1 }}>{child}</View>)}
  </View>;
}
