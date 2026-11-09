import { TextInput, useNativeState } from '@expo/ui';
import { Button, HStack, Image, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityHidden, accessibilityLabel, buttonStyle, font, frame, listRowBackground, listStyle, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useSyncExternalStore } from 'react';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { FactoryApparatusPickerProps } from './factoryApparatusPickerTypes';
import { useFactoryApparatusPicker } from './useFactoryApparatusPicker';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function FactoryApparatusPicker(props: FactoryApparatusPickerProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), picker = useFactoryApparatusPicker(props, locale);
  const search = useNativeState(''), theme = useBaseTheme();
  return <BaseHost style={{ flex: 1 }}><VStack spacing={10}>
    <HStack><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{picker.text.title}</Text><Spacer />
      <Button systemImage="xmark" onPress={props.onCancel} modifiers={[accessibilityLabel(localizedGetter('closeAction', locale))]} /></HStack>
    <HStack><Image systemName="magnifyingglass" modifiers={[accessibilityHidden()]} />
      <TextInput value={search} onChangeText={picker.setQuery} placeholder={picker.text.search} accessibilityLabel={picker.text.search}
        autoCapitalize="none" modifiers={[textFieldStyle('roundedBorder'), frame({ maxWidth: Infinity })]} />
    </HStack>
    <List modifiers={[listStyle('plain')]}>
      {picker.rows.length === 0 ? <Text>{picker.text.empty}</Text> : picker.rows.map(row => row.kind === 'heading'
        ? <Section key={row.key}><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>{row.title}</Text></Section>
        : <Button key={row.key} onPress={() => picker.toggle(row.item.id)} modifiers={[accessibilityLabel(row.item.name),
          ...(picker.selected.has(row.item.id) ? [accessibilityAddTraits(['isSelected']), listRowBackground(theme.colors.primaryContainer)] : [])]}>
          <HStack><Image systemName={picker.selected.has(row.item.id) ? 'checkmark.circle.fill' : 'circle'}
            modifiers={[accessibilityHidden()]} /><Text>{row.item.name}</Text><Spacer /></HStack>
        </Button>)}
    </List>
    <Button label={picker.text.confirm} systemImage="checkmark" onPress={picker.confirm} modifiers={[frame({ maxWidth: Infinity }), buttonStyle('borderedProminent')]} />
  </VStack></BaseHost>;
}
