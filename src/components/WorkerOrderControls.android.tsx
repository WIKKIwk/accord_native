import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
export { WorkerSheetButton as WorkerOrderButton } from './WorkerSheetButton';

export function WorkerOrderActionGroup({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 8 }}>
    {Children.toArray(children).map((child, index) => <View key={index} style={{ flex: 1 }}>{child}</View>)}
  </View>;
}
