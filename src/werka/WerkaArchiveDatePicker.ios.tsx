import { Button, HStack, Image, RNHostView, ScrollView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityHidden, accessibilityIdentifier, accessibilityLabel,
  border, buttonStyle, disabled, font, frame } from '@expo/ui/swift-ui/modifiers';
import { useRef } from 'react';
import { WerkaArchivePager, type WerkaArchivePagerHandle } from './WerkaArchivePager.ios';
import { werkaArchivePickerYears } from './werkaArchivePickerModel';
import { werkaArchivePickerPage, type WerkaArchiveDatePickerProps } from './werkaArchivePickerPresentation';
import { useWerkaArchivePicker } from './useWerkaArchivePicker';

/** Explicit native calendar inside the owner's SwiftUI Host, not a substituted stock DatePicker. */
export function WerkaArchiveDatePicker(props: WerkaArchiveDatePickerProps) {
  const picker = useWerkaArchivePicker(props), context = props.localeContext;
  const pager = useRef<WerkaArchivePagerHandle>(null);
  const scroll = (step: -1 | 1) => picker.requestMonthStep(step, async page => {
    if (!pager.current) throw new Error();
    pager.current.scrollToPage(page);
  });
  const years = werkaArchivePickerYears(picker.state.displayMonth, props.currentDate, props.bounds);
  const dayPage = (date: Date) => {
    const model = werkaArchivePickerPage(date, picker.state.selectedDate, props);
    return <VStack spacing={0}>
      <HStack spacing={0}>{model.weekdayLabels.map((label, index) => <Text key={index}
        modifiers={[frame({ maxWidth: Infinity, minHeight: 48, maxHeight: 48 }), accessibilityHidden(), font({ textStyle: 'caption' })]}>{label}</Text>)}</HStack>
      {model.rows.map((row, rowIndex) => <HStack key={rowIndex} spacing={0}>{row.map((cell, column) => cell === null
        ? <Spacer key={column} modifiers={[frame({ maxWidth: Infinity, minHeight: 48, maxHeight: 48 }), accessibilityHidden()]} />
        : <Button key={cell.id} label={cell.label} onPress={() => picker.selectDay(cell.date)} modifiers={[
          buttonStyle(cell.selected ? 'borderedProminent' : 'borderless'), frame({ maxWidth: Infinity, minHeight: 48, maxHeight: 48 }),
          disabled(!props.enabled || !cell.enabled), accessibilityLabel(cell.accessibilityLabel), accessibilityIdentifier(cell.id),
          ...(cell.selected ? [accessibilityAddTraits(['isSelected'])] : []),
          ...(cell.today ? [border({ content: { type: 'hierarchical', style: 'primary' }, width: 1 })] : [])]} />)}</HStack>)}
      <Spacer />
    </VStack>;
  };
  return <VStack spacing={0} modifiers={[frame({ height: 388 }), disabled(!props.enabled)]}>
    <HStack modifiers={[frame({ height: 52 })]}>
      <Button onPress={picker.toggleMode} modifiers={[buttonStyle('borderless'), accessibilityLabel(context.selectYearSemanticsLabel),
        accessibilityIdentifier('archive_picker_mode')]}><HStack><Text>{context.formatMonthYear(new Date(picker.state.displayMonth.getTime()))}</Text>
        <Image systemName={picker.state.mode === 'day' ? 'chevron.down' : 'chevron.up'} /></HStack></Button><Spacer />
      {picker.state.mode === 'day' ? <><Button onPress={() => scroll(-1)} modifiers={[buttonStyle('borderless'),
        frame({ minWidth: 44, minHeight: 44 }), disabled(picker.index === 0 || !props.enabled),
        accessibilityLabel(context.previousMonthTooltip), accessibilityIdentifier('archive_picker_previous_month')]}><Image systemName="chevron.left" /></Button>
        <Button onPress={() => scroll(1)} modifiers={[buttonStyle('borderless'), frame({ minWidth: 44, minHeight: 44 }),
          disabled(picker.index === picker.months.length - 1 || !props.enabled), accessibilityLabel(context.nextMonthTooltip),
          accessibilityIdentifier('archive_picker_next_month')]}><Image systemName="chevron.right" /></Button></> : null}
    </HStack>
    {picker.state.mode === 'day' ? <RNHostView matchContents={{ vertical: true }}><WerkaArchivePager
      key={props.enabled ? 'enabled' : 'disabled'} ref={pager} initialPage={picker.index} pageCount={picker.months.length}
      enabled={props.enabled} onPageChanged={picker.showMonth} onPagerError={picker.reportPagerError}
      renderPage={index => dayPage(picker.months[index])} /></RNHostView>
      : <ScrollView modifiers={[frame({ height: 336 })]}><VStack spacing={0}>
      {years.rows.map((row, index) => <HStack key={index} spacing={8}>{row.map(cell => <Button key={cell.year}
        label={context.formatYear(cell.year)} onPress={() => picker.selectYear(cell.year)} modifiers={[
          buttonStyle(cell.selected ? 'borderedProminent' : 'borderless'), frame({ maxWidth: Infinity, minHeight: 52, maxHeight: 52 }), disabled(!props.enabled || !cell.enabled),
          accessibilityIdentifier(`archive_picker_year_${cell.year}`), ...(cell.selected ? [accessibilityAddTraits(['isSelected'])] : []),
          ...(cell.today ? [border({ content: { type: 'hierarchical', style: 'primary' }, width: 1 })] : [])]} />)}</HStack>)}
    </VStack></ScrollView>}
  </VStack>;
}
