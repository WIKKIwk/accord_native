import { HStack, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';
import type { WorkerOutputProgressProps } from '../workerOutputProgress';
import { BaseHost } from './BaseHost';
import { useWorkerOutputProgress } from './useWorkerOutputProgress';
export function WorkerOutputProgress(props: WorkerOutputProgressProps) {
  const state = useWorkerOutputProgress(props);
  if (!state.enabled) return null;
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <HStack><Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{state.title}</Text><Spacer /><Text>{state.percent}</Text></HStack>
      {state.ratio !== null && <ProgressView value={state.ratio} />}
      <Text>{state.status || state.measured}</Text>
      {!!state.footnote && <Text modifiers={[font({ size: 13 }), foregroundStyle('secondary')]}>{state.footnote}</Text>}
    </VStack>
  </BaseHost>;
}
