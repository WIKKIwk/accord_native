import type { Href } from 'expo-router';
import { Button, ContextMenu, Menu, Section, Text, TextField } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationInputSheet, PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { preparationCreateWarehouse, preparationDeleteWarehouse, preparationRenameWarehouse } from './preparationManagementApi';
import { preparationMaterialAvailable, preparationMaterialHistory, preparationReceiptMode, preparationReceiptPayload, preparationVisibleMaterials } from './preparationLogic';

type Material = NonNullable<ReturnType<typeof usePreparationContext>['home']['snapshot']>['materials'][number];

// @v2 PreparationWarehouseScreen
export function PreparationWarehouse() {
  const { home, session } = usePreparationContext();
  const t = usePreparationText(), sheet = useNativeSheet();
  const [query, setQuery] = useState(''), [managing, setManaging] = useState(false);
  const { snapshot, warehouse, controller } = home;
  const mode = preparationReceiptMode(warehouse, snapshot?.material_warehouses ?? []);
  const items = preparationVisibleMaterials(snapshot?.materials ?? [], warehouse, query);
  const blocked = home.locked || managing;
  const prompt = (title: string, label: string, save: (value: string) => Promise<void>, initial = '', quantity = false) => {
    sheet.open(<PreparationInputSheet title={title} label={label} initial={initial} quantity={quantity} close={sheet.close} save={save} />,
      { compact: true, dismissible: false });
  };
  const receive = (material: Material) => {
    if (!warehouse) return;
    prompt(`${material.name} — kirim`, 'Kirim (kg)', async kg => {
      await controller.submit('receipts', preparationReceiptPayload(material, warehouse, kg)); Alert.alert(t('Saqlandi'));
    }, '', true);
  };
  const createMaterial = () => {
    if (!warehouse) return;
    prompt('Yangi homashyo', 'Homashyo nomi', async name => {
      await controller.submit('materials', { name, warehouse }); Alert.alert(t('Saqlandi'));
    });
  };
  const manage = async (operation: () => Promise<void>) => {
    setManaging(true); try { await operation(); } finally { setManaging(false); }
  };
  const createWarehouse = (parent: string) => prompt('Bola ombor ochish', 'Ombor nomi', name => manage(async () => {
    const saved = await preparationCreateWarehouse(session, name, parent); await controller.reload(); controller.selectWarehouse(saved);
  }));
  const rename = (name: string) => prompt('Ombor nomini o‘zgartirish', 'Ombor nomi', value => manage(async () => {
    const wasSelected = controller.getSnapshot().warehouse === name;
    const saved = await preparationRenameWarehouse(session, name, value); await controller.reload();
    if (wasSelected) controller.selectWarehouse(saved);
  }), name);
  const remove = (name: string) => Alert.alert(t('Omborni o‘chirish'), name, [
    { text: t('Bekor qilish'), style: 'cancel' },
    { text: t('O‘chirish'), style: 'destructive', onPress: () => { void manage(async () => {
      const wasSelected = controller.getSnapshot().warehouse === name;
      await preparationDeleteWarehouse(session, name); await controller.reload();
      if (wasSelected) {
        const remaining = controller.getSnapshot().snapshot?.assigned_warehouses ?? [];
        if (remaining[0]) controller.selectWarehouse(remaining[0]);
      }
    }).catch(preparationAlert); } },
  ]);
  return <><Stack.Screen options={{ title: t('Ombor') }} /><PreparationList refresh={controller.reload.bind(controller)}>
    <PreparationStatus loading={home.loading} error={home.error} retry={() => { void controller.reload(); }} />
    <Section><Menu label={`${t('Ombor')}: ${warehouse ?? t('Tanlanmagan')}`}>
      {(snapshot?.assigned_warehouses ?? []).map(name => <Button key={name} label={name} modifiers={[disabled(blocked)]} onPress={() => controller.selectWarehouse(name)} />)}
    </Menu><TextField placeholder={t('Qidirish')} onTextChange={setQuery} /></Section>
    {snapshot?.assigned_warehouses.length === 0 && <Section><Text>{t('Sizga ombor biriktirilmagan.')}</Text></Section>}
    {snapshot && snapshot.assigned_warehouses.length > 0 && !warehouse && <Section><Text>{t('Yuqoridagi filtrdan ombor tanlang.')}</Text></Section>}
    {warehouse && <Section>
      {items.length === 0 && <Text>{t('Bu omborda hali kirim yo‘q.')}</Text>}
      {items.map(material => <Button key={material.code} onPress={() => router.push(`/ios-preparation/material-detail?code=${encodeURIComponent(material.code)}` as Href)}>
        <Text>{material.name} · {t('Mavjud qoldiq')}: {preparationMaterialAvailable(material, warehouse)} kg</Text>
      </Button>)}
    </Section>}
    <Section title={t('Amallar')}>
      {mode === 'manual' && <Menu label={t('Kirim')} modifiers={[disabled(blocked)]}>
        {items.filter(item => item.can_receive).map(item => <Button key={item.code} label={item.name} onPress={() => receive(item)} />)}
      </Menu>}
      {mode === 'manual' && <Button label={t('Homashyo qo‘shish')} modifiers={[disabled(blocked)]} onPress={createMaterial} />}
      {!!snapshot?.material_warehouses.length && <Menu label={t('Ombor qo‘shish')} modifiers={[disabled(blocked)]}>
        {snapshot.material_warehouses.map(name => <Button key={name} label={name} onPress={() => createWarehouse(name)} />)}
      </Menu>}
      {(snapshot?.managed_warehouses ?? []).filter(name => snapshot?.assigned_warehouses.includes(name)).map(name => <ContextMenu key={name}>
        <ContextMenu.Trigger><Text>{name}</Text></ContextMenu.Trigger><ContextMenu.Items>
          <Button label={t('Nomini o‘zgartirish')} modifiers={[disabled(blocked)]} onPress={() => rename(name)} />
          <Button label={t('O‘chirish')} role="destructive" modifiers={[disabled(blocked)]} onPress={() => remove(name)} />
        </ContextMenu.Items></ContextMenu>)}
    </Section>
  </PreparationList></>;
}

// @v2 PreparationMaterialDetailScreen
export function PreparationMaterialDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { home } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const { warehouse, snapshot, controller } = home;
  const material = snapshot?.materials.find(item => item.code === code);
  const history = preparationMaterialHistory(snapshot?.history ?? [], warehouse ?? '', code ?? '');
  const mode = preparationReceiptMode(warehouse, snapshot?.material_warehouses ?? []);
  const receive = () => {
    if (!warehouse || !material) return;
    sheet.open(<PreparationInputSheet title={`${material.name} — kirim`} label="Kirim (kg)" quantity close={sheet.close} save={async kg => {
      await controller.submit('receipts', preparationReceiptPayload(material, warehouse, kg)); Alert.alert(t('Saqlandi'));
    }} />, { compact: true, dismissible: false });
  };
  return <><Stack.Screen options={{ title: material?.name ?? t('Homashyo') }} /><PreparationList refresh={controller.reload.bind(controller)}>
    <PreparationStatus loading={home.loading} error={home.error} retry={() => { void controller.reload(); }} />
    {material && <Section><Text>{material.name}</Text><Text>{t('Mavjud qoldiq')}: {preparationMaterialAvailable(material, warehouse)} kg</Text>
      {mode === 'manual' && <Button label={t('Kirim qilish')} modifiers={[disabled(home.locked || !material.can_receive)]} onPress={receive} />}</Section>}
    {history.receipts.length > 0 && <Section title={t('Kirimlar')}>{history.receipts.map((item, index) => <Text key={index}>
      {String(item.kg ?? '')} kg · {String(item.created_at ?? '')} {item.reversed === true ? t('Bekor qilingan') : ''} {String(item.reason ?? '')}
    </Text>)}</Section>}
    {history.consumptions.length > 0 && <Section title={t('Chiqimlar')}>{history.consumptions.map(({ doc, line }, index) => <Text key={index}>
      {String(line.kg ?? '')} kg · {String(doc.created_at ?? '')} · {String(doc.order_id ?? '')}
    </Text>)}</Section>}
    {!history.receipts.length && !history.consumptions.length && <Section><Text>{t('Bu homashyo bo‘yicha hali kirim yoki chiqim yo‘q.')}</Text></Section>}
  </PreparationList></>;
}
