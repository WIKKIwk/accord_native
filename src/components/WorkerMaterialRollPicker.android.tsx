import { Button, Checkbox, Column, Host, ListItem, LazyColumn, Text } from '@expo/ui/jetpack-compose';
import { clickable, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import type { WorkerMaterialRollPickerProps } from './workerMaterialRollPickerTypes';
import { useWorkerMaterialRollPicker } from './useWorkerMaterialRollPicker';
/** @v2 MaterialLinkRollPicker */
export function WorkerMaterialRollPicker({ rolls, select }: WorkerMaterialRollPickerProps) {
  const { selected, t, toggle } = useWorkerMaterialRollPicker();
  return <Host style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 12 }} modifiers={[padding(16, 16, 16, 16)]}>
    <Text>{t('So‘rov yuboriladigan rulonlarni tanlang')}</Text>
    <LazyColumn modifiers={[weight(1), fillMaxWidth()]}>{rolls.map(roll => <ListItem key={roll.barcode} modifiers={[clickable(() => toggle(roll.barcode))]}>
      <ListItem.HeadlineContent><Text>{`${roll.barcode} • ${roll.itemName}`}</Text></ListItem.HeadlineContent>
      <ListItem.SupportingContent><Text>{`${roll.qty} ${roll.uom} • ${roll.locationName}`}</Text></ListItem.SupportingContent>
      <ListItem.LeadingContent><Checkbox value={selected.includes(roll.barcode)} onCheckedChange={() => toggle(roll.barcode)} /></ListItem.LeadingContent>
    </ListItem>)}</LazyColumn>
    <Button enabled={!!selected.length} modifiers={[fillMaxWidth()]} onClick={() => select([...selected].sort())}><Text>{`${t('So‘rov yuborish')} (${selected.length})`}</Text></Button>
  </Column></Host>;
}
