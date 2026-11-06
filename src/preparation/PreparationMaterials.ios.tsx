import { Button, ContextMenu, Host, List, ProgressView, Section, Text, TextField, Toggle, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationInputSheet, PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { usePreparationMaterials } from './usePreparationMaterials';

type Choices = { name: string; editable: boolean; selected: boolean }[];
function AssignmentSheet({ choices, close, save }: { choices: Choices; close: () => void; save: (selected: string[]) => Promise<void> }) {
  const t = usePreparationText();
  const initial = choices.filter(choice => choice.selected).map(choice => choice.name).sort();
  const [selected, setSelected] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const changed = JSON.stringify([...selected].sort()) !== JSON.stringify(initial);
  const submit = async () => {
    setBusy(true); setError('');
    try { await save([...selected].sort()); close(); Alert.alert(t('Ombor biriktirish yangilandi')); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <Host style={{ minHeight: 320 }}><VStack><Text>{t('Bu amal ombordagi qoldiqni ko‘chirmaydi.')}</Text>
    <List>{choices.map(choice => <Toggle key={choice.name} label={choice.name} isOn={selected.includes(choice.name)}
      modifiers={[disabled(busy || !choice.editable)]} onIsOnChange={value => setSelected(current => value
        ? [...current, choice.name] : current.filter(name => name !== choice.name))} />)}
      {choices.some(choice => !choice.editable) && <Text>{t('Bu biriktirishni faqat administrator o‘zgartira oladi')}</Text>}
      {choices.length === 0 && <Text>{t('Sizga exclusive ombor biriktirilmagan.')}</Text>}
    </List>
    {!!error && <Text>{error}</Text>}{busy && <ProgressView />}
    <Button label={t('Saqlash')} modifiers={[disabled(busy || !changed)]} onPress={() => { void submit(); }} />
    <Button label={t('Bekor qilish')} modifiers={[disabled(busy)]} onPress={close} />
  </VStack></Host>;
}

// @v2 PreparationMaterialsScreen
export function PreparationMaterials() {
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const state = usePreparationMaterials(session), { controller } = state;
  const blocked = state.loading || state.refreshing || state.saving;
  const rename = (item: typeof state.items[number]) => sheet.open(<PreparationInputSheet title="Homashyo nomini o‘zgartirish"
    label="Homashyo nomi" initial={item.name} close={sheet.close} save={name => controller.rename(item, name)} />, { compact: true, dismissible: false });
  const remove = (item: typeof state.items[number]) => Alert.alert(t('Homashyoni o‘chirish'),
    t('Homashyo ishlatilgan: qoldiq, kirim, formula yoki boshqa bog‘langan yozuvlar bor. Uni o‘chirib bo‘lmaydi'), [
      { text: t('Bekor qilish'), style: 'cancel' },
      { text: t('O‘chirish'), style: 'destructive', onPress: () => { void controller.remove(item).catch(preparationAlert); } },
    ]);
  const assign = async (item: typeof state.items[number]) => {
    try {
      const choices = await controller.warehouseChoices(item);
      if (choices) sheet.open(<AssignmentSheet choices={choices} close={sheet.close} save={selected => controller.setWarehouses(item, selected)} />,
        { compact: true, dismissible: false });
    } catch (error) { preparationAlert(error); }
  };
  return <><Stack.Screen options={{ title: t('Homashyolar') }} /><PreparationList refresh={() => controller.load(true)}>
    <Section><TextField placeholder={t('Homashyoni qidirish')} onTextChange={value => controller.setQuery(value)} /></Section>
    <PreparationStatus loading={state.loading || state.saving} error={state.error} retry={() => { void controller.load(); }} />
    <Section>
      {!state.loading && !state.error && state.filtered.length === 0 && <Text>{t(state.items.length ? 'Homashyo topilmadi.' : 'Hali homashyo yaratmagansiz.')}</Text>}
      {state.filtered.map(item => <ContextMenu key={item.item_code}><ContextMenu.Trigger><VStack alignment="leading">
        <Text>{item.name}</Text><Text>{item.item_code} · {item.warehouses.length ? item.warehouses.join(', ') : t('Ombor biriktirilmagan')}</Text>
      </VStack></ContextMenu.Trigger><ContextMenu.Items>
        <Button label={t('Nomini o‘zgartirish')} modifiers={[disabled(blocked)]} onPress={() => rename(item)} />
        <Button label={t('Omborga biriktirish')} modifiers={[disabled(blocked)]} onPress={() => { void assign(item); }} />
        <Button label={t('O‘chirish')} role="destructive" modifiers={[disabled(blocked)]} onPress={() => remove(item)} />
      </ContextMenu.Items></ContextMenu>)}
    </Section>
  </PreparationList></>;
}
