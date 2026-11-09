import { Column, HorizontalPager, IconButton, LazyColumn, RNHostView, Row, Text, TextButton,
  useMaterialColors, type HorizontalPagerHandle } from '@expo/ui/jetpack-compose';
import { border, fillMaxWidth, height, semantics, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { werkaArchivePickerYears } from './werkaArchivePickerModel';
import { werkaArchivePickerPage, type WerkaArchiveDatePickerProps } from './werkaArchivePickerPresentation';
import { useWerkaArchivePicker } from './useWerkaArchivePicker';

/** Explicit native calendar inside the owner's Compose Host, not a substituted DateTimePicker. */
export function WerkaArchiveDatePicker(props: WerkaArchiveDatePickerProps) {
  const picker = useWerkaArchivePicker(props), colors = useMaterialColors(), context = props.localeContext;
  const pager = useRef<HorizontalPagerHandle>(null), years = werkaArchivePickerYears(picker.state.displayMonth, props.currentDate, props.bounds);
  const scroll = (step: -1 | 1) => picker.requestMonthStep(step, page => {
    const native = pager.current;
    return native ? native.animateScrollToPage(page) : Promise.reject(new Error());
  });
  const dayPage = (date: Date) => {
    const model = werkaArchivePickerPage(date, picker.state.selectedDate, props);
    return <Column modifiers={[fillMaxWidth()]}>
      <Row modifiers={[fillMaxWidth(), height(48)]}>{model.weekdayLabels.map((label, index) => <Text key={index}
        modifiers={[weight(1)]} style={{ typography: 'labelMedium', textAlign: 'center' }}>{label}</Text>)}</Row>
      {model.rows.map((row, index) => <Row key={index} modifiers={[fillMaxWidth(), height(48)]}>{row.map((cell, column) => cell === null
        ? <Column key={column} modifiers={[weight(1), height(48)]} />
        : <TextButton key={cell.id} onClick={() => picker.selectDay(cell.date)} enabled={props.enabled && cell.enabled}
          contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }} colors={{
            containerColor: cell.selected ? colors.primary : 'transparent', contentColor: cell.selected ? colors.onPrimary : colors.onSurface }}
          modifiers={[weight(1), height(48), semantics({ contentDescription: cell.accessibilityLabel }), testID(cell.id),
            ...(cell.today ? [border(1, colors.primary)] : [])]}><Text style={{ typography: 'bodyMedium' }}>{cell.label}</Text></TextButton>)}</Row>)}
    </Column>;
  };
  return <Column modifiers={[fillMaxWidth(), height(388)]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth(), height(52)]}>
      <TextButton onClick={picker.toggleMode} enabled={props.enabled} modifiers={[weight(1),
        semantics({ contentDescription: context.selectYearSemanticsLabel }), testID('archive_picker_mode')]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}><Text>{context.formatMonthYear(new Date(picker.state.displayMonth.getTime()))}</Text>
          <RNHostView matchContents><SymbolView name={{ android: picker.state.mode === 'day' ? 'arrow_drop_down' : 'arrow_drop_up' }}
            size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></Row>
      </TextButton>
      {picker.state.mode === 'day' ? <><IconButton onClick={() => scroll(-1)} enabled={props.enabled && picker.index > 0}
        modifiers={[semantics({ contentDescription: context.previousMonthTooltip }), testID('archive_picker_previous_month')]}>
        <RNHostView matchContents><SymbolView name={{ android: 'chevron_left' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton>
        <IconButton onClick={() => scroll(1)} enabled={props.enabled && picker.index < picker.months.length - 1}
          modifiers={[semantics({ contentDescription: context.nextMonthTooltip }), testID('archive_picker_next_month')]}>
          <RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton></> : null}
    </Row>
    {picker.state.mode === 'day' ? <HorizontalPager key={props.enabled ? 'enabled' : 'disabled'} ref={pager} initialPage={picker.index} onCurrentPageChange={picker.showMonth}
      userScrollEnabled={props.enabled} modifiers={[fillMaxWidth(), height(336), testID('archive_picker_month_pager')]}>
      {picker.months.map(date => <Column key={`${date.getFullYear()}:${date.getMonth()}`}>{dayPage(date)}</Column>)}
    </HorizontalPager> : <LazyColumn modifiers={[fillMaxWidth(), height(336)]}>
      {years.rows.map((row, index) => <Row key={index} horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), height(52)]}>
        {row.map(cell => <TextButton key={cell.year} onClick={() => picker.selectYear(cell.year)} enabled={props.enabled && cell.enabled}
          colors={{ containerColor: cell.selected ? colors.primary : 'transparent', contentColor: cell.selected ? colors.onPrimary : colors.onSurface }}
          modifiers={[weight(1), height(52), testID(`archive_picker_year_${cell.year}`), ...(cell.today ? [border(1, colors.primary)] : [])]}>
          <Text style={{ typography: 'bodyLarge' }}>{context.formatYear(cell.year)}</Text>
        </TextButton>)}
      </Row>)}
    </LazyColumn>}
  </Column>;
}
