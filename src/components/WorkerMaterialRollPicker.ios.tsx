import { Button, List, Section, Text, Toggle, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, padding } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from './BaseHost';
import type { WorkerMaterialRollPickerProps } from './workerMaterialRollPickerTypes';
import { useWorkerMaterialRollPicker } from './useWorkerMaterialRollPicker';
/** @v2 MaterialLinkRollPicker */
export function WorkerMaterialRollPicker({ rolls, select }: WorkerMaterialRollPickerProps) {
  const { selected, t, toggle } = useWorkerMaterialRollPicker();
  return <BaseHost style={{ flex: 1 }}><VStack spacing={12}>
    <Text>{t('So‘rov yuboriladigan rulonlarni tanlang')}</Text>
    <List><Section>{rolls.map(roll => <Toggle key={roll.barcode} isOn={selected.includes(roll.barcode)} onIsOnChange={() => toggle(roll.barcode)}>
      <Text>{`${roll.barcode} • ${roll.itemName}`}</Text><Text>{`${roll.qty} ${roll.uom} • ${roll.locationName}`}</Text>
    </Toggle>)}</Section></List>
    <Button label={`${t('So‘rov yuborish')} (${selected.length})`} modifiers={[buttonStyle('borderedProminent'), disabled(!selected.length), padding({ horizontal: 16, bottom: 16 })]} onPress={() => select([...selected].sort())} />
  </VStack></BaseHost>;
}
