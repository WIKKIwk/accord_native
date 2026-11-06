import { ActivityIndicator } from 'react-native';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationButton, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { usePreparationMaterials } from './usePreparationMaterials';

// @v2 PreparationMaterialsScreen
export function PreparationMaterialsScreen() {
  const { session } = usePreparationContext(), state = usePreparationMaterials(session), dialogs = usePreparationDialogs(), t = usePreparationText();
  const blocked = state.loading || state.refreshing || state.saving;
  const showError = (error: unknown) => dialogs.message('Xatolik yuz berdi', error instanceof Error ? error.message : String(error));
  const menu = async (item: typeof state.items[number]) => {
    if (blocked) return;
    const action = await dialogs.choose(item.name, [
      { label: 'Nomini o‘zgartirish', value: 'rename' }, { label: 'Omborga biriktirish', value: 'warehouses' }, { label: 'O‘chirish', value: 'delete' },
    ]);
    try {
      if (action === 'rename') {
        const name = await dialogs.input({ title: 'Nomini o‘zgartirish', label: 'Homashyo nomi', initial: item.name });
        if (name !== null) await state.controller.rename(item, name);
      } else if (action === 'delete') {
        const confirmed = await dialogs.confirm('Homashyoni o‘chirish',
          'Ishlatilgan homashyo, qoldiq, kirim yoki formula bo‘lsa, uni o‘chirib bo‘lmaydi.', 'O‘chirish');
        if (confirmed) await state.controller.remove(item);
      } else if (action === 'warehouses') {
        const choices = await state.controller.warehouseChoices(item);
        if (!choices) return;
        const initial = choices.filter(choice => choice.selected).map(choice => choice.name).sort();
        const selected = new Set(initial);
        for (;;) {
          const changed = JSON.stringify([...selected].sort()) !== JSON.stringify(initial);
          const choice = await dialogs.choose('Omborga biriktirish', [
            ...choices.map(entry => ({ label: `${selected.has(entry.name) ? '☑' : '☐'} ${entry.name}`, value: entry.name,
              disabled: !entry.editable, subtitle: entry.editable ? undefined : t('Bu biriktirishni faqat administrator o‘zgartira oladi') })),
            { label: 'Saqlash', value: '\u0000save', disabled: !changed },
          ]);
          if (choice === null) return;
          if (choice === '\u0000save') {
            if (await dialogs.confirm('Omborga biriktirish', t('Bu amal ombordagi qoldiqni ko‘chirmaydi.'))) {
              await state.controller.setWarehouses(item, [...selected].sort());
            }
            return;
          }
          if (selected.has(choice)) selected.delete(choice); else selected.add(choice);
        }
      }
    } catch (error) { showError(error); }
  };
  return <PreparationPage title="Homashyolar" refreshing={state.refreshing} onRefresh={() => void state.controller.load(true)}>
    <PreparationField label="Homashyoni qidirish" onChange={value => state.controller.setQuery(value)} />
    {state.loading && !state.items.length ? <ActivityIndicator /> : null}
    {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.load()} /></> : null}
    {!state.loading && !state.filtered.length && !state.error ? <PreparationText>{t(state.items.length ? 'Homashyo topilmadi.' : 'Hali homashyo yaratmagansiz.')}</PreparationText> : null}
    {state.filtered.map(item => <PreparationRow key={item.item_code} title={item.name}
      subtitle={`${item.item_code} · ${item.warehouses.length ? item.warehouses.join(', ') : t('Ombor biriktirilmagan')}`}
      disabled={blocked} onPress={() => void menu(item)} />)}
  </PreparationPage>;
}
