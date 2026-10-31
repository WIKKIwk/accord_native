import { Host, TabView, Text } from '@expo/ui/swift-ui';
import { tabViewStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

type Props = { active: string; onSelect: (id: string) => void; onScan: () => void };

/** SwiftUI owns the three navigation destinations. */
export function WorkerBottomBar({ active, onSelect }: Props) {
  const selection = active === 'profile' || active === 'chat' ? active : 'home';
  return (
    <View style={styles.root}>
      <Host style={styles.bar} colorScheme="light" seedColor="#285140">
        <TabView selection={selection} onSelectionChange={onSelect} modifiers={[tabViewStyle({ type: 'automatic' }), tint('#285140')]}>
          <TabView.Tab value="home" label="Asosiy" systemImage="house"><Text> </Text></TabView.Tab>
          <TabView.Tab value="profile" label="Profil" systemImage="person"><Text> </Text></TabView.Tab>
          <TabView.Tab value="chat" label="Chat" systemImage="bubble.left"><Text> </Text></TabView.Tab>
        </TabView>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', height: 72, backgroundColor: '#f8f9fb', borderTopColor: '#e6ebe7', borderTopWidth: StyleSheet.hairlineWidth },
  bar: { width: '100%', height: 72 },
});
