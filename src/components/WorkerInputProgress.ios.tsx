import { HStack, Image, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { fixedSize, font, foregroundStyle, frame, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, StyleSheet, View } from 'react-native';
import type { WorkerInputProgressModel } from '../workerInputProgress';
import { BaseHost } from './BaseHost';

// @v2 _PreviousProgressQrTile
// @v2 _InputProgressBatchList
// @v2 _InputProgressBatchTile
export function WorkerInputProgress({ model }: { model: WorkerInputProgressModel }) {
  return <View testID="worker-input-progress" style={[styles.container, { backgroundColor: PlatformColor('tertiarySystemGroupedBackground') }]}>
    <BaseHost matchContents={{ vertical: true }} style={styles.host}>
      <HStack alignment="top" spacing={12}>
        <Image systemName={model.ready ? 'checkmark.circle.fill' : 'qrcode.viewfinder'} size={26} color={PlatformColor('systemBlue')} />
        <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'headline' }), fixedSize({ horizontal: false, vertical: true })]}>{model.title}</Text>
          <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary'), lineLimit(2), fixedSize({ horizontal: false, vertical: true })]}>{model.subtitle}</Text>
        </VStack>
      </HStack>
    </BaseHost>
    <View style={styles.list}>
      <BaseHost matchContents={{ vertical: true }} style={styles.host}>
        <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'headline' }), fixedSize({ horizontal: false, vertical: true })]}>{model.products}</Text>
          {model.summary ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary'), lineLimit(3), fixedSize({ horizontal: false, vertical: true })]}>{model.summary}</Text> : null}
          {model.loading ? <ProgressView /> : model.error ? <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{model.error}</Text>
            : !model.rows.length ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{model.empty}</Text> : null}
        </VStack>
      </BaseHost>
      {model.rows.map(row => <View key={row.id} testID={row.selected ? 'worker-input-selected' : 'worker-input-candidate'}
        accessibilityState={{ selected: row.selected }} style={[styles.row, {
          backgroundColor: PlatformColor(row.selected ? 'secondarySystemFill' : 'secondarySystemGroupedBackground'),
          borderColor: row.selected ? PlatformColor('systemBlue') : 'transparent',
        }]}>
        <BaseHost matchContents={{ vertical: true }} style={styles.host}>
          <HStack alignment="top" spacing={10}>
            <Image systemName={row.selected ? 'checkmark.circle.fill' : row.available ? 'qrcode.viewfinder' : 'checkmark.circle'} size={24} color={PlatformColor('systemBlue')} />
            <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), lineLimit(2), fixedSize({ horizontal: false, vertical: true })]}>{row.title}</Text>
              <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle('secondary'), lineLimit(1)]}>{row.status}</Text>
              <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{row.qr}</Text>
            </VStack>
          </HStack>
        </BaseHost>
      </View>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  host: { width: '100%' }, container: { borderRadius: 14, padding: 12, gap: 16 },
  list: { gap: 8 }, row: { borderRadius: 12, borderWidth: 1.4, padding: 10 },
});
