import { HStack, Image, Picker, Section, Text } from '@expo/ui/swift-ui';
import { foregroundStyle, frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import type { AppThemeVariant } from '../shared/themeController';
import { themeController } from '../shared/themeRuntime';
import { useBaseLocale } from './useBaseLocale.ios';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const subscribe = (listener: () => void) => themeController.addListener(listener);
const themeSnapshot = () => themeController.variant;
const variants: { value: AppThemeVariant; key: string }[] = [
  { value: 'kalmar', key: 'themeKalmarLabel' }, { value: 'classic', key: 'themeClassicLabel' },
  { value: 'moss', key: 'themeMossLabel' }, { value: 'lavender', key: 'themeLavenderLabel' },
  { value: 'bliss', key: 'themeBlissLabel' }, { value: 'white', key: 'themeWhiteLabel' },
];

export function ProfileSettingsPreferences() {
  const { locale, text } = useBaseLocale();
  const variant = useSyncExternalStore(subscribe, themeSnapshot, themeSnapshot);
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
    <Picker label={<HStack spacing={12}><Image systemName="paintpalette" size={18} modifiers={[frame({ width: 22 }), secondary]} />
      <Text>{text('themeTitle')}</Text></HStack>} selection={variant} onSelectionChange={value => {
        const selection = variants.find(option => option.value === value);
        if (selection) void themeController.setVariant(selection.value).catch(() => Alert.alert(text('themeTitle'), text('retry')));
      }} modifiers={[pickerStyle('menu')]}>
      {variants.map(option => <Text key={option.value} modifiers={[tag(option.value)]}>{text(option.key)}</Text>)}
    </Picker>
  </Section>;
}
