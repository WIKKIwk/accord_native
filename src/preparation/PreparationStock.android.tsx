import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { preparationReverseReceipt } from './preparationCommandApi';
import { usePreparationContext } from './PreparationContext.android';
import { preparationCreateWarehouse, preparationDeleteWarehouse, preparationRenameWarehouse } from './preparationManagementApi';
import { preparationMaterialAvailable, preparationMaterialHistory, preparationReceiptMode, preparationReceiptPayload,
  preparationReverseHistory, preparationVisibleMaterials, type PreparationMaterial } from './preparationLogic';
import { preparationDisplay } from './preparationModel';
import { PreparationButton, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

function useStockActions() {
  const { home } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const receive = async (material: PreparationMaterial) => {
    if (!home.warehouse || !home.snapshot || home.locked) return;
    if (preparationReceiptMode(home.warehouse, home.snapshot.material_warehouses) !== 'manual') return;
    const kg = await dialogs.input({ title: `${material.name} — kirim`, label: 'Kirim (kg)', quantity: true });
    if (kg === null) return;
    try { await home.controller.submit('receipts', preparationReceiptPayload(material, home.warehouse, kg)); dialogs.message('Saqlandi', t('Saqlandi')); }
    catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
  };
  const createMaterial = async () => {
    if (!home.warehouse || home.locked) return;
    const name = await dialogs.input({ title: 'Yangi homashyo', label: 'Homashyo nomi' });
    if (name === null) return;
    try { await home.controller.submit('materials', { name, warehouse: home.warehouse }); dialogs.message('Saqlandi', t('Saqlandi')); }
    catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
  };
  return { receive, createMaterial };
}

// @v2 PreparationWarehouseScreen
export function PreparationWarehouseScreen() {
  const { home, session } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const { receive, createMaterial } = useStockActions();
  const [query, setQuery] = useState(''), [managing, setManaging] = useState(false);
  const data = home.snapshot, warehouse = home.warehouse;
  const materials = preparationVisibleMaterials(data?.materials ?? [], warehouse, query);
  const manual = preparationReceiptMode(warehouse, data?.material_warehouses ?? []) === 'manual';
  const manage = async (kind: 'create' | 'rename' | 'delete') => {
    if (!data || managing || home.locked) return;
    try {
      if (kind === 'create') {
        const parent = await dialogs.choose('Ombor tanlang', data.material_warehouses.map(name => ({ label: name, value: name })));
        if (!parent) return;
        const name = await dialogs.input({ title: 'Ombor qo‘shish', label: 'Ombor nomi' });
        if (name === null) return;
        setManaging(true);
        const created = await preparationCreateWarehouse(session, name, parent);
        await home.controller.reload(); home.controller.selectWarehouse(created);
      } else if (warehouse && kind === 'rename') {
        const name = await dialogs.input({ title: 'Ombor nomini o‘zgartirish', label: 'Ombor nomi', initial: warehouse });
        if (name === null) return;
        setManaging(true);
        const renamed = await preparationRenameWarehouse(session, warehouse, name);
        await home.controller.reload(); home.controller.selectWarehouse(renamed);
      } else if (warehouse && kind === 'delete') {
        if (!(await dialogs.confirm('Omborni o‘chirish', `${warehouse} — ${t('O‘chirilsinmi?')}`, 'O‘chirish'))) return;
        setManaging(true);
        await preparationDeleteWarehouse(session, warehouse);
        await home.controller.reload();
        const first = home.controller.getSnapshot().snapshot?.assigned_warehouses[0];
        if (first) home.controller.selectWarehouse(first);
      }
    } catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
    finally { setManaging(false); }
  };
  const selectWarehouse = async () => {
    const selected = await dialogs.choose('Ombor', (data?.assigned_warehouses ?? []).map(name => ({ label: name, value: name })));
    if (selected !== null) home.controller.selectWarehouse(selected);
  };
  const warehouseMenu = async () => {
    if (!warehouse || !data?.managed_warehouses.includes(warehouse) || home.locked || managing) return;
    const action = await dialogs.choose(warehouse, [{ label: 'Nomini o‘zgartirish', value: 'rename' }, { label: 'O‘chirish', value: 'delete' }]);
    if (action === 'rename' || action === 'delete') void manage(action);
  };
  const pickReceipt = async () => {
    const receivable = preparationVisibleMaterials(data?.materials ?? [], warehouse).filter(item => item.can_receive);
    const code = await dialogs.choose('Homashyo tanlang', receivable.map(item => ({ label: item.name, value: item.code })));
    const material = receivable.find(item => item.code === code);
    if (material) await receive(material);
  };
  return <PreparationPage title="Ombor" refreshing={home.loading} onRefresh={() => void home.controller.reload()}>
    {!data?.assigned_warehouses.length ? <PreparationText>{t('Sizga ombor biriktirilmagan.')}</PreparationText> : null}
    <PreparationRow title={t('Ombor')} subtitle={warehouse ?? t('Tanlanmagan')} onPress={() => void selectWarehouse()}
      onLongPress={() => void warehouseMenu()} disabled={home.locked || managing} />
    <PreparationField label="Qidirish" onChange={setQuery} />
    {!warehouse ? <PreparationText>{t('Yuqoridagi filtrdan ombor tanlang.')}</PreparationText>
      : !materials.length ? <PreparationText>{t('Bu omborda hali kirim yo‘q.')}</PreparationText> : null}
    {materials.map(item => <PreparationRow key={item.code} title={item.name}
      subtitle={`${t('Mavjud qoldiq')}: ${preparationDisplay(preparationMaterialAvailable(item, warehouse))} kg`}
      onPress={() => router.push({ pathname: '/android-preparation/material', params: { code: item.code } } as unknown as Href)} />)}
    {warehouse && manual ? <>
      <PreparationButton label="Kirim" disabled={home.locked || managing} onPress={() => void pickReceipt()} id="preparation-receipt" />
      <PreparationButton label="Homashyo qo‘shish" disabled={home.locked || managing} onPress={() => void createMaterial()} />
    </> : null}
    {data?.material_warehouses.length ? <PreparationButton label="Ombor qo‘shish" disabled={home.locked || managing} onPress={() => void manage('create')} /> : null}
  </PreparationPage>;
}

function historyTitle(doc: Record<string, unknown>) {
  if (doc.kind === 'receipt') return `Kirim — ${String(doc.name ?? '')}`;
  if (doc.kind === 'receipt_reversal') return `Kirimni bekor qilish — ${String(doc.name ?? '')}`;
  return `Sarf — ${String(doc.order_code ?? '')} ${String(doc.order_title ?? '')}`;
}
function historySubtitle(doc: Record<string, unknown>) {
  const text = [doc.warehouse, doc.created_at, doc.kg != null ? `${preparationDisplay(String(doc.kg))} kg` : null,
    doc.reversed === true ? 'Bekor qilingan' : null, doc.reason].filter(Boolean);
  return text.join(' · ');
}

// @v2 PreparationMaterialDetailScreen
export function PreparationMaterialDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { home } = usePreparationContext(), { receive } = useStockActions(), t = usePreparationText();
  const item = home.snapshot?.materials.find(material => material.code === code);
  const warehouse = home.warehouse;
  const history = preparationMaterialHistory(home.snapshot?.history ?? [], warehouse ?? '', code ?? '');
  const manual = preparationReceiptMode(warehouse, home.snapshot?.material_warehouses ?? []) === 'manual';
  return <PreparationPage title={item?.name ?? 'Homashyo'} refreshing={home.loading} onRefresh={() => void home.controller.reload()}>
    {item ? <PreparationRow title={item.name} subtitle={`${t('Mavjud qoldiq')}: ${preparationDisplay(preparationMaterialAvailable(item, warehouse))} kg`} /> : null}
    {item && manual && item.can_receive ? <PreparationButton label="Kirim qilish" disabled={home.locked} onPress={() => void receive(item)} /> : null}
    {!history.receipts.length && !history.consumptions.length ? <PreparationText>{t('Bu homashyo bo‘yicha hali kirim yoki chiqim yo‘q.')}</PreparationText> : null}
    {history.receipts.length ? <PreparationText title>{t('Kirimlar')}</PreparationText> : null}
    {history.receipts.map((doc, index) => <PreparationRow key={`${String(doc.id ?? '')}-${index}`} title={historyTitle(doc)} subtitle={historySubtitle(doc)} />)}
    {history.consumptions.length ? <PreparationText title>{t('Chiqimlar')}</PreparationText> : null}
    {history.consumptions.map(({ doc, line }, index) => <PreparationRow key={`${String(doc.id ?? '')}-${index}`} title={historyTitle(doc)}
      subtitle={`${historySubtitle(doc)} · ${String(line.kg ?? '')} kg`} />)}
  </PreparationPage>;
}

// @v2 PreparationHistoryScreen
export function PreparationHistoryScreen() {
  const { home, session } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [local, setLocal] = useState<Record<string, unknown>[] | null>(null), [busy, setBusy] = useState(false);
  const history = local ?? home.snapshot?.history ?? [];
  const refresh = async () => { await home.controller.reload(); setLocal(null); };
  const reverse = async (doc: Record<string, unknown>) => {
    const action = await dialogs.choose(historyTitle(doc), [{ label: 'Kirimni bekor qilish', value: 'reverse', disabled: doc.can_reverse !== true }]);
    if (action !== 'reverse') return;
    const reason = await dialogs.input({ title: 'Kirimni bekor qilish', label: 'Sabab', emptyError: 'Sabab kiriting', maxLength: 500 });
    if (reason === null || !(await dialogs.confirm('Kirimni bekor qilish', `${String(doc.kg ?? '0')} kg kirim bekor qilinsinmi? Bu amal tarixda saqlanadi.`, 'Bekor qilish'))) return;
    setBusy(true);
    try {
      const id = doc.id == null ? null : String(doc.id);
      const result = await preparationReverseReceipt(session, id ?? '', reason);
      setLocal(preparationReverseHistory(history, id, result, new Date().toISOString()));
      await home.controller.reload(); dialogs.message('Kirim bekor qilindi', t('Kirim bekor qilindi'));
    } catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
    finally { setBusy(false); }
  };
  return <PreparationPage title="Tarix" refreshing={home.loading} onRefresh={() => void refresh()}>
    {!history.length ? <PreparationText>{t('Hali kirim yoki sarf yo‘q.')}</PreparationText> : null}
    {history.map((doc, index) => <PreparationRow key={`${String(doc.id ?? '')}-${index}`} title={historyTitle(doc)} subtitle={historySubtitle(doc)}
      onLongPress={doc.kind === 'receipt' && doc.reversed !== true && !busy ? () => void reverse(doc) : undefined} />)}
  </PreparationPage>;
}
