import { Button, Column, FilledTonalButton, FilterChip, Host, IconButton, OutlinedTextField, RNHostView, Row, Text, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { KeyboardAvoidingView, ScrollView, View, useWindowDimensions } from 'react-native';
import { localizedGetter } from '../shared/localization';
import { qolipGridLetters } from './qolipGridLogic';
import { useQolipGridCellPicker, type QolipGridCellPickerProps } from './useQolipGridCellPicker';
import { useQolipText } from './useQolipText';

// Unopened content. Its required callback returns only the chosen label.
export function QolipGridCellPicker(props: QolipGridCellPickerProps) {
  const state = useQolipGridCellPicker(props), input = useNativeState(''), { text, locale } = useQolipText(), colors = useMaterialColors();
  const { height } = useWindowDimensions();
  if (state.invalid) return null;
  const clear = () => { input.set(''); state.controller.setQuery(''); };
  const submit = (value: string) => { state.controller.setQuery(value); state.submit(); };
  return <KeyboardAvoidingView behavior="padding"><View style={{ maxHeight: height * 0.88, paddingHorizontal: 16, paddingBottom: 20 }}>
    <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 99, backgroundColor: colors.onSurfaceVariant, marginTop: 10, marginBottom: 16 }} />
    <Host matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 12 }}>
      <Text style={{ typography: 'titleLarge', fontWeight: '800' }}>{props.title ?? text('cell_picker.title')}</Text>
      <OutlinedTextField value={input} singleLine onValueChange={value => state.controller.setQuery(value)}
        keyboardOptions={{ capitalization: 'characters', imeAction: 'done' }} keyboardActions={{ onDone: submit }} modifiers={[fillMaxWidth(), testID('qolip-grid-cell-search')]}>
        <OutlinedTextField.Placeholder><Text>{text('cell_picker.search_hint')}</Text></OutlinedTextField.Placeholder>
        <OutlinedTextField.LeadingIcon><RNHostView matchContents><SymbolView name={{ android: 'search' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView></OutlinedTextField.LeadingIcon>
        {state.query !== '' && <OutlinedTextField.TrailingIcon><IconButton onClick={clear} modifiers={[semantics({ contentDescription: localizedGetter('clearTitle', locale) })]}>
          <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton></OutlinedTextField.TrailingIcon>}
      </OutlinedTextField>
    </Column></Host>
    <View style={{ height: 12 }} />
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
      {state.searching ? <Host matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 8 }}>
        {state.results.length === 0 ? <Text>{text('cell_picker.no_match')}</Text> : <>
          {state.primary && <Button onClick={() => state.chooseResult(state.primary!)} modifiers={[fillMaxWidth()]}><Text>{text('cell_picker.select', { cell: state.primary })}</Text></Button>}
          {state.primary && state.otherResults.length > 0 && <Text>{text('cell_picker.other_matches')}</Text>}
          {state.otherResults.map(label => <FilledTonalButton key={label} onClick={() => state.chooseResult(label)} modifiers={[fillMaxWidth()]}>
            <Row modifiers={[fillMaxWidth()]}><Text>{label}</Text></Row></FilledTonalButton>)}
        </>}
      </Column></Host> : <>
        <Host matchContents={{ vertical: true }}><Text>{text('cell_picker.row')}</Text></Host>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}><Host matchContents>
          <Row horizontalArrangement={{ spacedBy: 8 }}>{qolipGridLetters.map(letter => <FilterChip key={letter} selected={letter === state.selectedLetter}
            onClick={() => state.controller.selectLetter(letter)}><FilterChip.Label><Text>{letter}</Text></FilterChip.Label></FilterChip>)}</Row>
        </Host></ScrollView>
        <Host matchContents={{ vertical: true }}><Text>{text('cell_picker.row_heading', { letter: state.selectedLetter })}</Text></Host>
        <View style={{ gap: 10, marginTop: 10 }}>{Array.from({ length: Math.ceil(state.grid.length / 3) }, (_, index) => <View key={index} style={{ flexDirection: 'row', gap: 10 }}>
          {state.grid.slice(index * 3, index * 3 + 3).map(cell => <View key={cell.label} style={{ flex: 1, aspectRatio: 1.45 }}><Host style={{ flex: 1 }}>
            <FilledTonalButton enabled={!cell.excluded} onClick={() => state.chooseGrid(cell.label)} modifiers={[fillMaxSize(), testID(`qolip-grid-cell-${cell.label}`)]}>
              <Text style={{ typography: 'titleLarge', fontWeight: '900' }}>{cell.label}</Text></FilledTonalButton>
          </Host></View>)}{Array.from({ length: 3 - state.grid.slice(index * 3, index * 3 + 3).length }, (_, missing) => <View key={`empty-${missing}`} style={{ flex: 1 }} />)}
        </View>)}</View>
      </>}
    </ScrollView>
  </View></KeyboardAvoidingView>;
}
