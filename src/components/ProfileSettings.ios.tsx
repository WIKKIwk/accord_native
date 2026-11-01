import { Button, Group, HStack, Image, List, NavigationStack, Picker, Section, Spacer, Text, Toolbar, ToolbarItem } from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, frame, listStyle, navigationBarTitleDisplayMode, navigationTitle, pickerStyle, presentationDetents, presentationDragIndicator, tag } from '@expo/ui/swift-ui/modifiers';
import Constants from 'expo-constants';
import { Alert } from 'react-native';
import { isAppearancePreference } from '../appAppearance';
import { useAppSettings } from './AppSettings';

type Props = { onClose: () => void; onLogout: () => void };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

export function ProfileSettings({ onClose, onLogout }: Props) {
  const { appearance, setAppearance } = useAppSettings();
  return <Group modifiers={[presentationDetents(['large']), presentationDragIndicator('visible')]}>
    <NavigationStack>
      <Toolbar modifiers={[navigationTitle('Sozlamalar'), navigationBarTitleDisplayMode('inline')]}>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Ko‘rinish">
            <Picker label={<HStack spacing={12}>
              <Image systemName="circle.lefthalf.filled" size={18} modifiers={[frame({ width: 22 }), secondary]} />
              <Text>Yorug‘lik rejimi</Text>
            </HStack>} selection={appearance} onSelectionChange={value => {
              if (isAppearancePreference(value)) void setAppearance(value).catch(() => Alert.alert('Saqlab bo‘lmadi', 'Sozlamani qayta saqlab ko‘ring.'));
            }} modifiers={[pickerStyle('menu')]}>
              <Text modifiers={[tag('system')]}>Tizim</Text>
              <Text modifiers={[tag('light')]}>Yorug‘</Text>
              <Text modifiers={[tag('dark')]}>Qorong‘i</Text>
            </Picker>
          </Section>
          <Section title="Ilova">
            <HStack spacing={12}>
              <Image systemName="info.circle" size={18} modifiers={[frame({ width: 22 }), secondary]} />
              <Text>Versiya</Text><Spacer />
              <Text modifiers={[secondary]}>{Constants.expoConfig?.version ?? '—'}</Text>
            </HStack>
          </Section>
          <Section>
            <Button role="destructive" label="Sessiyani uzish" systemImage="rectangle.portrait.and.arrow.right" modifiers={[buttonStyle('plain')]} onPress={() => {
              Alert.alert('Sessiyani uzish', 'Ushbu qurilmada hisobdan chiqilsinmi?', [
                { text: 'Bekor qilish', style: 'cancel' },
                { text: 'Uzish', style: 'destructive', onPress: onLogout },
              ]);
            }} />
          </Section>
          <Section><Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>Ko‘rinish tanlovi ushbu qurilmada saqlanadi.</Text></Section>
        </List>
        <Toolbar.Content><ToolbarItem placement="topBarTrailing"><Button label="Tayyor" onPress={onClose} /></ToolbarItem></Toolbar.Content>
      </Toolbar>
    </NavigationStack>
  </Group>;
}
