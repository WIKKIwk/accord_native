import { Button, Column, Host, RNHostView, Text } from '@expo/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

type Props = { active: string; onSelect: (id: string) => void; onScan: () => void };
type Destination = { id: string; label: string; symbol: SymbolViewProps['name'] };
const destinations: Destination[] = [
  { id: 'home', label: 'Asosiy', symbol: { ios: 'house.fill', android: 'home', web: 'home' } },
  { id: 'profile', label: 'Profil', symbol: { ios: 'person.fill', android: 'person', web: 'person' } },
  { id: 'chat', label: 'Chat', symbol: { ios: 'bubble.left.fill', android: 'chat_bubble', web: 'chat_bubble' } },
];
export function WorkerBottomBar({ active, onSelect }: Props) {
  return <View style={styles.root}>
    {destinations.map(item => {
      const selected = active === item.id;
      const color = selected ? '#285140' : '#63726b';
      return <Host key={item.id} colorScheme="light" seedColor="#285140" style={styles.item}>
        <Button variant="text" style={{ width: '100%', height: 64 }} onPress={() => onSelect(item.id)}>
          <Column alignment="center" spacing={3}>
            <RNHostView matchContents><SymbolView name={item.symbol} size={24} tintColor={color} /></RNHostView>
            <Text textStyle={{ fontSize: 11, fontWeight: selected ? '700' : '500', color }}>{item.label}</Text>
          </Column>
        </Button>
      </Host>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  root: { width: '100%', flexDirection: 'row', backgroundColor: '#f8f9fb', borderTopColor: '#e6ebe7', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, height: 64 },
});
