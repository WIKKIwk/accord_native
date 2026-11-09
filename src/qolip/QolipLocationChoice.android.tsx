import { Column, Host, LazyColumn, ListItem, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { clickable, fillMaxSize, fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { localizedMethod } from '../shared/localization';
import { qolipLocationChoiceLabel } from './qolipLocationChoiceLabels';
import type { QolipLocationChoiceProps } from './qolipLocationChoiceProps';
import { useQolipLocationChoice } from './useQolipLocationChoice';
import { useQolipText } from './useQolipText';

// Unopened read-only sheet content. Choosing returns the original row; no attach/move/take/print action is dispatched.
export function QolipLocationChoice(props: QolipLocationChoiceProps) {
  const state = useQolipLocationChoice(props), { locale } = useQolipText(), colors = useMaterialColors();
  if (!state.valid) return null;
  return <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 20 }}><Host style={{ flex: 1 }}>
    <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxSize()]}>
      <Text style={{ typography: 'titleLarge' }}>{props.title}</Text><LazyColumn modifiers={[fillMaxWidth()]}>
        {props.options.map((item, index) => {
          const label = qolipLocationChoiceLabel(item, localizedMethod('qolipCount', locale, { count: item.quantity }));
          return <ListItem key={`${item.id}:${index}`} modifiers={[clickable(() => state.choose(item))]}>
            <ListItem.LeadingContent><RNHostView matchContents><SymbolView name={{ android: 'layers' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></ListItem.LeadingContent>
            <ListItem.HeadlineContent><Text>{label.title}</Text></ListItem.HeadlineContent>
            <ListItem.SupportingContent><Text>{label.subtitle}</Text></ListItem.SupportingContent>
          </ListItem>;
        })}
      </LazyColumn>
    </Column>
  </Host></View>;
}
