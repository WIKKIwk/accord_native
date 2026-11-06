import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ActivityIndicator } from 'react-native';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationButton, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { preparationReceiptMode, preparationReceiptPayload, preparationVisibleMaterials } from './preparationLogic';

// @v2 PreparationScreen
export function PreparationHomeScreen() {
  const { home } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const hadFocus = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hadFocus.current) void home.controller.reload();
    hadFocus.current = true;
  }, [home.controller]));
  const data = home.snapshot;
  const submit = async (kind: string, payload: Record<string, unknown>) => {
    try { await home.controller.submit(kind, payload); dialogs.message('Saqlandi', t('Saqlandi')); }
    catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
  };
  const receive = async () => {
    if (!data) return;
    const mode = preparationReceiptMode(home.warehouse, data.material_warehouses);
    if (mode === 'warehouse') { router.push('/android-preparation/warehouse' as Href); return; }
    if (mode === 'scale') return;
    const materials = preparationVisibleMaterials(data.materials, home.warehouse).filter(item => item.can_receive);
    const code = await dialogs.choose('Homashyo tanlang', materials.map(item => ({ label: item.name, value: item.code })));
    const material = materials.find(item => item.code === code);
    if (!material || !home.warehouse) return;
    const kg = await dialogs.input({ title: `${material.name} — kirim`, label: 'Kirim (kg)', quantity: true });
    if (kg !== null) await submit('receipts', preparationReceiptPayload(material, home.warehouse, kg));
  };
  const actions = async () => {
    if (!data) return;
    const chosen = await dialogs.choose('Amallar', [
      { label: 'Ombor', value: 'warehouse', disabled: home.locked },
      { label: 'Homashyolar', value: 'materials', disabled: home.locked },
      { label: 'Mahsulot formulasi', value: 'sets', disabled: home.locked },
      ...(preparationReceiptMode(home.warehouse, data.material_warehouses) !== 'scale' ? [{ label: 'Kirim', value: 'receive', disabled: home.locked }] : []),
      { label: 'Tarix', value: 'history' },
    ]);
    if (chosen === 'receive') void receive();
    else if (chosen === 'warehouse') router.push('/android-preparation/warehouse' as Href);
    else if (chosen === 'materials') router.push('/android-preparation/materials' as Href);
    else if (chosen === 'sets') router.push('/android-preparation/sets' as Href);
    else if (chosen === 'history') router.push('/android-preparation/history' as Href);
  };
  const menu = async () => {
    const chosen = await dialogs.choose('Tayyorlov masteri', [
      { label: 'Tayyorlov', value: 'home' }, { label: 'Formulalar', value: 'formulas' },
      { label: 'Ishlab chiqarish', value: 'production' },
    ]);
    if (chosen === 'formulas') router.replace('/android-preparation/formulas' as Href);
    else if (chosen === 'production') router.replace('/android-preparation/production' as Href);
  };
  return <PreparationPage title="Tayyorlov masteri" root refreshing={home.loading && !!data}
    onRefresh={() => { if (!home.loading && !home.saving) void home.controller.reload(); }}>
    <PreparationButton label="Menyu" onPress={() => void menu()} id="preparation-menu" />
    {home.loading && !data ? <ActivityIndicator /> : null}
    {home.error ? <PreparationRow title={t('Xatolik yuz berdi')} subtitle={home.error} /> : null}
    {data && !data.assigned_warehouses.length ? <PreparationText>{t('Sizga ombor biriktirilmagan. Admin foydalanuvchi kartasidan ombor biriktirishi kerak.')}</PreparationText> : null}
    {home.pending ? <PreparationRow title={t('Tasdiqlanmagan operatsiya')}
      subtitle={Object.values(home.pending.payload).map(String).join(' · ')} /> : null}
    {home.pending ? <PreparationButton label="Tekshirish" disabled={home.saving || home.loading} onPress={() => {
      if (home.pending) void submit(home.pending.kind, home.pending.payload);
    }} /> : null}
    {data ? <>
      <PreparationRow title={t('Ombor')} subtitle={home.warehouse ?? t('Tanlanmagan')} disabled={home.locked} onPress={() => router.push('/android-preparation/warehouse' as Href)} />
      <PreparationRow title={t('Homashyolar')} disabled={home.locked} onPress={() => router.push('/android-preparation/materials' as Href)} />
      <PreparationRow title={t('Mahsulot formulasi')} disabled={home.locked} onPress={() => router.push('/android-preparation/sets' as Href)} />
      <PreparationRow title={t('Ishlab chiqarish')} onPress={() => router.replace('/android-preparation/production' as Href)} />
      <PreparationRow title={t('Tarix')} onPress={() => router.push('/android-preparation/history' as Href)} />
      <PreparationButton label="Amallar" onPress={() => void actions()} id="preparation-actions" />
    </> : null}
  </PreparationPage>;
}
