import { Button, Host, HStack, List, Section, Spacer, Text, TextField, Toggle, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, labelStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationInputDialog } from './PreparationInputDialog';
import { PreparationNotice } from './PreparationNotice';
import { PreparationList, PreparationStatus, usePreparationText } from './PreparationUI';
import { preparationMaterialDeleteMessage, preparationMaterialsEmptyMessage, preparationMaterialsErrorMessage, usePreparationMaterials } from './usePreparationMaterials';
import { usePreparationNotice } from './usePreparationNotice';

type Choices = { name: string; editable: boolean; selected: boolean }[];
type MaterialAction = 'rename' | 'warehouses' | 'delete';

function MaterialActions({ name, choose }: { name: string; choose: (action: MaterialAction) => void }) {
  const t = usePreparationText();
  return <Host matchContents={{ vertical: true }}><VStack spacing={12}>
    <Text>{name}</Text>
    <Button label={t('Nomini o‘zgartirish')} onPress={() => choose('rename')} />
    <Button label={t('Omborga biriktirish')} onPress={() => choose('warehouses')} />
    <Button label={t('O‘chirish')} role="destructive" onPress={() => choose('delete')} />
  </VStack></Host>;
}

function AssignmentSheet({ name, choices, save }: { name: string; choices: Choices; save: (selected: string[]) => void }) {
  const t = usePreparationText();
  const initial = choices.filter(choice => choice.selected).map(choice => choice.name).sort();
  const [selected, setSelected] = useState(initial);
  const changed = JSON.stringify([...selected].sort()) !== JSON.stringify(initial);
  return <Host style={{ minHeight: 320 }}><VStack spacing={10}>
    <Text>{t('Omborga biriktirish')}</Text><Text>{name}</Text>
    <List>{choices.map(choice => <Toggle key={choice.name} isOn={selected.includes(choice.name)}
      modifiers={[disabled(!choice.editable)]} onIsOnChange={value => setSelected(current => value
        ? current.includes(choice.name) ? current : [...current, choice.name] : current.filter(entry => entry !== choice.name))}>
      <Text>{choice.name}</Text>
      {!choice.editable && <Text>{t('Bu biriktirishni faqat administrator o‘zgartira oladi')}</Text>}
    </Toggle>)}
      {choices.length === 0 && <Text>{t('Sizga exclusive ombor biriktirilmagan.')}</Text>}
    </List>
    <Text>{t('Bu amal ombordagi qoldiqni ko‘chirmaydi.')}</Text>
    <Button label={t('Saqlash')} modifiers={[disabled(!changed)]} onPress={() => save([...selected].sort())} />
  </VStack></Host>;
}

// @v2 PreparationMaterialsScreen
export function PreparationMaterials() {
  const { session } = usePreparationContext(), t = usePreparationText();
  const state = usePreparationMaterials(session), { controller } = state;
  const actionSheet = useNativeSheet(), assignmentSheet = useNativeSheet(), notice = usePreparationNotice();
  const afterAction = useRef<(() => void) | null>(null), afterAssignment = useRef<(() => void) | null>(null);
  const [renameItem, setRenameItem] = useState<typeof state.items[number] | null>(null);
  const blocked = state.loading || state.refreshing || state.saving;
  const failure = (error: unknown) => notice.show(t(preparationMaterialsErrorMessage(error)));
  const assign = async (item: typeof state.items[number]) => {
    try {
      const choices = await controller.warehouseChoices(item);
      if (!choices) return;
      assignmentSheet.open(<AssignmentSheet name={item.name} choices={choices} save={selected => {
        afterAssignment.current = () => { void controller.setWarehouses(item, selected)
          .then(saved => { if (saved) notice.show(t('Ombor biriktirish yangilandi')); }).catch(failure); };
        assignmentSheet.close();
      }} />, { compact: true, dismissible: true, onDismiss: () => {
        const next = afterAssignment.current; afterAssignment.current = null; next?.();
      } });
    } catch (error) { failure(error); }
  };
  const perform = (item: typeof state.items[number], action: MaterialAction) => {
    if (action === 'rename') { setRenameItem(item); return; }
    if (action === 'warehouses') { void assign(item); return; }
    Alert.alert(t('Homashyoni o‘chirish'), preparationMaterialDeleteMessage(item.name), [
      { text: t('Bekor qilish'), style: 'cancel' },
      { text: t('O‘chirish'), style: 'destructive', onPress: () => { void controller.remove(item)
        .then(saved => { if (saved) notice.show(t('Homashyo o‘chirildi')); }).catch(failure); } },
    ]);
  };
  const openActions = (item: typeof state.items[number]) => {
    if (blocked) return;
    actionSheet.open(<MaterialActions name={item.name} choose={action => {
      afterAction.current = () => perform(item, action); actionSheet.close();
    }} />, { compact: true, dismissible: true, onDismiss: () => {
      const next = afterAction.current; afterAction.current = null; next?.();
    } });
  };
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Homashyolar') }} /><PreparationList refresh={() => controller.load(true)}>
    <Section><TextField placeholder={t('Homashyoni qidirish')} onTextChange={value => controller.setQuery(value)} /></Section>
    <PreparationStatus loading={state.loading || state.saving} error={state.error} retry={() => { void controller.load(); }} />
    <Section>
      {!state.loading && !state.error && state.filtered.length === 0 && <Text>{t(preparationMaterialsEmptyMessage(state.query))}</Text>}
      {state.filtered.map(item => <HStack key={item.item_code}>
        <Button modifiers={[disabled(blocked), buttonStyle('plain')]} onPress={() => openActions(item)}>
          <VStack alignment="leading"><Text>{item.name}</Text>
            <Text>{item.warehouses.length ? item.warehouses.join(', ') : t('Ombor biriktirilmagan')}</Text></VStack>
        </Button><Spacer />
        <Button label={t('Homashyo amallari')} systemImage="ellipsis" modifiers={[disabled(blocked), labelStyle('iconOnly'), accessibilityLabel(t('Homashyo amallari'))]}
          onPress={() => openActions(item)} />
      </HStack>)}
    </Section>
  </PreparationList><PreparationNotice message={notice.message} />
    {renameItem && <PreparationInputDialog key={renameItem.item_code} title="Homashyo nomini o‘zgartirish" label="Homashyo nomi"
      initial={renameItem.name} close={() => setRenameItem(null)} save={name => {
      const item = renameItem; setRenameItem(null);
      void controller.rename(item, name).then(saved => { if (saved) notice.show(t('Homashyo nomi o‘zgartirildi')); }).catch(failure);
    }} />}
  </View>;
}
