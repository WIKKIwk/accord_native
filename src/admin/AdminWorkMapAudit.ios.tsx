import { ListItem } from '@expo/ui';
import { Button, HStack, Image, ProgressView, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityLabel, background, buttonStyle, clipShape, disabled, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { AdminWorkMapAuditCounts } from './AdminWorkMapAuditCounts';
import type { AdminWorkMapAuditProps } from './adminWorkMapAuditTypes';

export function AdminWorkMapAudit({ model, onRefresh }: AdminWorkMapAuditProps) {
  const tone = PlatformColor(model.clean ? 'systemBlue' : 'systemRed');
  return <VStack alignment="leading" spacing={12}>
    <VStack alignment="leading" spacing={12} modifiers={[padding({ all: 16 }), background(PlatformColor('secondarySystemGroupedBackground')), clipShape('roundedRectangle', 12)]}>
      <HStack alignment="top" spacing={12}><Image systemName={model.clean ? 'checkmark.seal' : 'exclamationmark.triangle'} size={30} modifiers={[foregroundStyle(tone), accessibilityHidden()]} />
        <VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'headline', weight: 'bold' })]}>{model.title}</Text>
          <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{model.description}</Text></VStack><Spacer />
        <Button onPress={model.canRefresh ? () => { void onRefresh(); } : undefined}
          modifiers={[buttonStyle('plain'), disabled(!model.canRefresh), accessibilityLabel(model.refreshLabel), frame({ width: 48, height: 48 })]}>
          {model.loading ? <ProgressView /> : <Image systemName="arrow.clockwise" />}
        </Button>
      </HStack>
      {!!model.counts.length && <RNHostView matchContents={{ vertical: true }}><AdminWorkMapAuditCounts counts={model.counts} /></RNHostView>}
      {model.error != null && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{model.error}</Text>}
    </VStack>
    {model.violations.map(row => <ListItem key={row.key} supportingText={row.subtitle}
      leading={<Image systemName="exclamationmark.circle" modifiers={[foregroundStyle(PlatformColor('systemRed')), accessibilityHidden()]} />}><Text>{row.title}</Text></ListItem>)}
    {model.successTitle != null && <ListItem supportingText={model.successDescription ?? undefined}
      leading={<Image systemName="checkmark.circle" modifiers={[foregroundStyle(PlatformColor('systemBlue')), accessibilityHidden()]} />}><Text>{model.successTitle}</Text></ListItem>}
    {model.initialProgress && <ProgressView />}
  </VStack>;
}
