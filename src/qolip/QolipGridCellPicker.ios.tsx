import { Button, Host, HStack, Image, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityLabel, background, buttonStyle, disabled, font, frame, labelStyle, onSubmit,
  shapes, submitLabel, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { KeyboardAvoidingView, PlatformColor, ScrollView, View, useWindowDimensions } from 'react-native';
import { localizedGetter } from '../shared/localization';
import { qolipGridLetters } from './qolipGridLogic';
import { useQolipGridCellPicker, type QolipGridCellPickerProps } from './useQolipGridCellPicker';
import { useQolipText } from './useQolipText';

// Unopened content. Its required callback returns only the chosen label.
export function QolipGridCellPicker(props: QolipGridCellPickerProps) {
  const state = useQolipGridCellPicker(props), input = useNativeState(''), { text, locale } = useQolipText(), { height } = useWindowDimensions();
  if (state.invalid) return null;
  const clear = () => { input.set(''); state.controller.setQuery(''); };
  const submit = () => { state.controller.setQuery(input.get()); state.submit(); };
  return <KeyboardAvoidingView behavior="padding"><View style={{ maxHeight: height * 0.88, paddingHorizontal: 16, paddingBottom: 20 }}>
    <Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={12}>
      <HStack modifiers={[frame({ maxWidth: Infinity })]}><Text modifiers={[frame({ width: 42, height: 5 }),
        background(PlatformColor('tertiaryLabel'), shapes.roundedRectangle({ cornerRadius: 99 }))]}>{' '}</Text></HStack>
      <Text modifiers={[font({ size: 22, weight: 'bold' })]}>{props.title ?? text('cell_picker.title')}</Text>
      <HStack><Image systemName="magnifyingglass" /><TextField text={input} placeholder={text('cell_picker.search_hint')} onTextChange={value => state.controller.setQuery(value)}
        modifiers={[frame({ maxWidth: Infinity }), textInputAutocapitalization('characters'), submitLabel('done'), onSubmit(submit)]} />
        {state.query !== '' && <Button label={localizedGetter('clearTitle', locale)} systemImage="xmark.circle.fill" onPress={clear}
          modifiers={[labelStyle('iconOnly'), accessibilityLabel(localizedGetter('clearTitle', locale))]} />}</HStack>
    </VStack></Host>
    <View style={{ height: 12 }} />
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
      {state.searching ? <Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={8}>
        {state.results.length === 0 ? <Text>{text('cell_picker.no_match')}</Text> : <>
          {state.primary && <Button label={text('cell_picker.select', { cell: state.primary })} onPress={() => state.chooseResult(state.primary!)}
            modifiers={[buttonStyle('borderedProminent'), frame({ maxWidth: Infinity })]} />}
          {state.primary && state.otherResults.length > 0 && <Text>{text('cell_picker.other_matches')}</Text>}
          {state.otherResults.map(label => <Button key={label} label={label} onPress={() => state.chooseResult(label)}
            modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity, alignment: 'leading' })]} />)}
        </>}
      </VStack></Host> : <>
        <Host matchContents={{ vertical: true }}><Text>{text('cell_picker.row')}</Text></Host>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
          <Host matchContents><HStack spacing={8}>{qolipGridLetters.map(letter => <Button key={letter} label={letter} onPress={() => state.controller.selectLetter(letter)}
            modifiers={[buttonStyle(letter === state.selectedLetter ? 'borderedProminent' : 'bordered'),
              ...(letter === state.selectedLetter ? [accessibilityAddTraits(['isSelected'])] : [])]} />)}</HStack></Host>
        </ScrollView>
        <Host matchContents={{ vertical: true }}><Text>{text('cell_picker.row_heading', { letter: state.selectedLetter })}</Text></Host>
        <View style={{ gap: 10, marginTop: 10 }}>{Array.from({ length: Math.ceil(state.grid.length / 3) }, (_, index) => <View key={index} style={{ flexDirection: 'row', gap: 10 }}>
          {state.grid.slice(index * 3, index * 3 + 3).map(cell => <View key={cell.label} style={{ flex: 1, aspectRatio: 1.45 }}>
            <Host style={{ flex: 1 }}><Button label={cell.label} onPress={() => state.chooseGrid(cell.label)}
              modifiers={[buttonStyle('bordered'), disabled(cell.excluded), frame({ maxWidth: Infinity, maxHeight: Infinity })]} /></Host>
          </View>)}{Array.from({ length: 3 - state.grid.slice(index * 3, index * 3 + 3).length }, (_, missing) => <View key={`empty-${missing}`} style={{ flex: 1 }} />)}
        </View>)}</View>
      </>}
    </ScrollView>
  </View></KeyboardAvoidingView>;
}
