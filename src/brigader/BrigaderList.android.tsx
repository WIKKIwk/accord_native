import { CircularProgressIndicator, Column, RNHostView, Row as NativeRow, Surface, TextButton } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from '../admin/AdminTypography.android';
import { workerDetailSegmentShape } from '../admin/AdminWorkerDetailNative.android';
import { View } from 'react-native';
import type { ReactNode } from 'react';

export type FeatureRowProps = { title: string; subtitle?: string; index?: number; count?: number; onPress?: () => void; disabled?: boolean; trailing?: ReactNode; leading?: ReactNode };
export function FeatureRow({ title, subtitle, index = 0, count = 1, onPress, disabled, trailing, leading }: FeatureRowProps) {
  const { colors } = useBaseTheme();
  return <View style={{ paddingHorizontal: 4, paddingBottom: 2 }}><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Surface color={colors.surface} shape={workerDetailSegmentShape(index, count)} enabled={!disabled} onClick={onPress} modifiers={[fillMaxWidth()]}>
    <NativeRow verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 61 }), padding(14, 8, 14, 8)]}>
      {leading ? <RNHostView matchContents><View>{leading}</View></RNHostView> : null}<Column modifiers={[weight(1)]}><Text style={{ typography: 'titleMedium', fontWeight: '700' }}>{title}</Text>{subtitle ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{subtitle}</Text> : null}</Column>
      {trailing ? <RNHostView matchContents><View>{trailing}</View></RNHostView> : null}
    </NativeRow>
  </Surface></BaseHost></View>;
}
export function FeatureBusy() { return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><BaseHost matchContents><CircularProgressIndicator /></BaseHost></View>; }
export function FeatureError({ message, retry, label }: { message: string; retry: () => void; label: string }) { return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><BaseHost matchContents><Column horizontalAlignment="center"><Text>{message}</Text><TextButton onClick={retry}><Text>{label}</Text></TextButton></Column></BaseHost></View>; }
