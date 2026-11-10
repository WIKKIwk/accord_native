import { Column, Host, LinearProgressIndicator, Row, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';
import type { WorkerOutputProgressProps } from '../workerOutputProgress';
import { useWorkerOutputProgress } from './useWorkerOutputProgress';
export function WorkerOutputProgress(props: WorkerOutputProgressProps) {
  const state = useWorkerOutputProgress(props);
  if (!state.enabled) return null;
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth()]}>
      <Row><Text modifiers={[weight(1)]}>{state.title}</Text><Text>{state.percent}</Text></Row>
      {state.ratio !== null && <LinearProgressIndicator progress={state.ratio} modifiers={[fillMaxWidth()]} />}
      <Text>{state.status || state.measured}</Text>
      {!!state.footnote && <Text>{state.footnote}</Text>}
    </Column>
  </Host>;
}
