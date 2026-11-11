import { HStack, Image, Picker, Section, Text } from '@expo/ui/swift-ui';
import { foregroundStyle, frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Alert } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import { useBaseLocale } from './useBaseLocale.ios';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

export function ProfileSettingsPreferences() {
  const { locale, text } = useBaseLocale();
  return <Section>
    <Picker label={<HStack spacing={12}><Image systemName="globe" size={18} modifiers={[frame({ width: 22 }), secondary]} />
      <Text>{text('languageTitle')}</Text></HStack>} selection={locale.split('-')[0]} onSelectionChange={value => {
        if (value === 'uz' || value === 'en' || value === 'ru' || value === 'ur') {
          void localeController.setLocale(value).catch(() => Alert.alert(text('languageTitle'), text('retry')));
        }
      }} modifiers={[pickerStyle('menu')]}>
      <Text modifiers={[tag('uz')]}>{text('uzbek')}</Text>
      <Text modifiers={[tag('en')]}>{text('english')}</Text>
      <Text modifiers={[tag('ru')]}>{text('russian')}</Text>
      <Text modifiers={[tag('ur')]}>اردو (پاکستان)</Text>
    </Picker>
  </Section>;
}
