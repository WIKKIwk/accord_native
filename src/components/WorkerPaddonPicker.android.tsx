import { Column, Host, ListItem, RNHostView } from '@expo/ui/jetpack-compose';
import { clickable } from '@expo/ui/jetpack-compose/modifiers';
import { ScrollView, Text } from 'react-native';
import { useWorkerColors } from './useWorkerColors';
import type { WorkerPaddonPickerProps } from './workerPaddonPresentation';

export function WorkerPaddonPicker({ choices, choose }: WorkerPaddonPickerProps) {
  const colors = useWorkerColors();
  return <ScrollView><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>{choices.map(choice => <ListItem key={choice.id}
    modifiers={[clickable(() => choose(choice.id))]}><ListItem.HeadlineContent><RNHostView matchContents>
      <Text style={{ color: choice.destructive ? colors.error : colors.text, fontSize: 17 }}>{choice.title}</Text>
    </RNHostView></ListItem.HeadlineContent>{choice.subtitle ? <ListItem.SupportingContent><RNHostView matchContents><Text style={{ color: colors.icon }}>{choice.subtitle}</Text></RNHostView></ListItem.SupportingContent> : null}
  </ListItem>)}</Column></Host></ScrollView>;
}
