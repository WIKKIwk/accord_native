import { Button, Divider, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, contentShape, cornerRadius, disabled, font, foregroundStyle, frame, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { BaseHost as Host } from './BaseHost';
import { useWorkerOrderOverview, type WorkerOrderOverviewProps } from './useWorkerOrderOverview';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const card = [background(PlatformColor('secondarySystemGroupedBackground')), cornerRadius(22)];

export function WorkerOrderOverview(props: WorkerOrderOverviewProps) {
  const model = useWorkerOrderOverview(props);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack spacing={16}>
      <VStack spacing={0} modifiers={card}>
        <Button onPress={model.toggle} modifiers={[buttonStyle('plain'), disabled(!model.enabled), accessibilityIdentifier('worker-order-summary')]}>
          <HStack spacing={12} modifiers={[padding({ all: 18 }), frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
            <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>{model.title}</Text>
              <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{model.subtitle}</Text>
            </VStack>
            <Image systemName={model.expanded ? 'chevron.up' : 'chevron.down'} size={13} modifiers={[secondary]} />
          </HStack>
        </Button>
        {model.expanded && model.enabled ? <>
          <Divider modifiers={[padding({ horizontal: 18 })]} />
          {model.metrics.length ? <HStack spacing={12} modifiers={[padding({ horizontal: 18, vertical: 18 })]}>
            {model.metrics.map(metric => <VStack key={metric.id} alignment="leading" spacing={8}
              modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityIdentifier(`worker-order-metric-${metric.id}`)]}>
              <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{metric.label}</Text>
              <HStack alignment="firstTextBaseline" spacing={5}>
                <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>{metric.value}</Text>
                <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{metric.unit}</Text>
              </HStack>
            </VStack>)}
          </HStack> : null}
          <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 18, bottom: 6 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            {model.facts.map(fact => <VStack key={fact.id} alignment="leading" spacing={7} modifiers={[padding({ vertical: 12 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{fact.label}</Text>
              <Text modifiers={[font({ textStyle: 'body', weight: fact.id === 'print-side' ? 'medium' : 'regular' })]}>{fact.value}</Text>
            </VStack>)}
          </VStack>
        </> : null}
      </VStack>
      {model.expanded && model.stages.length ? <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), ...card]}>
        <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' }), padding({ horizontal: 18, top: 18, bottom: 10 })]}>{model.stagesTitle}</Text>
        {model.stages.map((stage, index) => {
          const active = ['in_progress', 'print_preflight', 'print_preflight_passed'].includes(stage.state);
          const row = <HStack spacing={14} modifiers={[padding({ horizontal: 18, vertical: 14 }), frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
            <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }),
              foregroundStyle(PlatformColor(active ? 'systemBlue' : 'secondaryLabel')), frame({ minWidth: 32, minHeight: 32 }),
              background(PlatformColor('tertiarySystemFill')), cornerRadius(16)]}>{String(stage.number)}</Text>
            <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text modifiers={[font({ textStyle: 'body', weight: active ? 'semibold' : 'regular' })]}>{stage.title}</Text>
              {stage.stateLabel ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor(active ? 'systemBlue' : 'secondaryLabel'))]}>{stage.stateLabel}</Text> : null}
            </VStack>
            <Spacer />
            {stage.apparatusId ? <Image systemName="chevron.right" size={11} modifiers={[secondary]} /> : null}
          </HStack>;
          return <VStack key={stage.id} spacing={0}>
            {stage.apparatusId ? <Button onPress={() => model.openStage(stage.apparatusId)}
              modifiers={[buttonStyle('plain'), accessibilityIdentifier(`worker-order-stage-${stage.id}`)]}>{row}</Button> : row}
            {index < model.stages.length - 1 ? <Divider modifiers={[padding({ leading: 64, trailing: 18 })]} /> : null}
          </VStack>;
        })}
      </VStack> : null}
    </VStack>
  </Host>;
}
