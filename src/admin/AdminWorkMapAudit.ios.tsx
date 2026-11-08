import { ListItem } from '@expo/ui';
import { Button, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityLabel, font, foregroundStyle, labelStyle } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import type { AdminWorkMapAuditProps } from './adminWorkMapAuditTypes';

export function AdminWorkMapAudit({ model, onRefresh }: AdminWorkMapAuditProps) {
  const tone = PlatformColor(model.clean ? 'systemBlue' : 'systemRed');
  return <VStack alignment="leading" spacing={12}>
    <VStack alignment="leading" spacing={8}>
      <HStack spacing={12}><Image systemName={model.clean ? 'checkmark.seal' : 'exclamationmark.triangle'} modifiers={[foregroundStyle(tone), accessibilityHidden()]} />
        <Text modifiers={[font({ textStyle: 'headline', weight: 'bold' })]}>{model.title}</Text><Spacer />
        {model.loading ? <ProgressView /> : <Button systemImage="arrow.clockwise" label={model.refreshLabel} onPress={() => { void onRefresh(); }}
          modifiers={[labelStyle('iconOnly'), accessibilityLabel(model.refreshLabel)]} />}
      </HStack>
      <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{model.description}</Text>
      {model.counts.map(count => <Text key={count.id}>{count.text}</Text>)}
      {!!model.error && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{model.error}</Text>}
    </VStack>
    {model.violations.map(row => <ListItem key={row.key} supportingText={row.subtitle}
      leading={<Image systemName="exclamationmark.circle" modifiers={[foregroundStyle(PlatformColor('systemRed')), accessibilityHidden()]} />}><Text>{row.title}</Text></ListItem>)}
    {model.successTitle != null && <ListItem supportingText={model.successDescription ?? undefined}
      leading={<Image systemName="checkmark.circle" modifiers={[foregroundStyle(PlatformColor('systemBlue')), accessibilityHidden()]} />}><Text>{model.successTitle}</Text></ListItem>}
    {model.initialProgress && <ProgressView />}
  </VStack>;
}
