import type { Href } from 'expo-router';
import { Button, Host, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationInputDialog } from './PreparationInputDialog';
import { PreparationNotice } from './PreparationNotice';
import { PreparationSeriyoPicker } from './PreparationSeriyoPicker';
import { PreparationWarehouseCreateDialog } from './PreparationWarehouseCreateDialog';
import { PreparationList, PreparationStatus, usePreparationText } from './PreparationUI';
import { preparationDisplay } from './preparationModel';
import { preparationMaterialConsumptionCard, preparationMaterialReceiptCard } from './preparationHistoryModel';
import { preparationCreateWarehouse, preparationDeleteWarehouse, preparationRenameWarehouse } from './preparationManagementApi';
import { preparationMaterialAvailable, preparationMaterialHistory, preparationReceiptMode, preparationReceiptPayload, preparationVisibleMaterials } from './preparationLogic';
import { openPreparationScale } from './PreparationRoutes';
import { preparationWarehouseDeleteMessage, preparationWarehouseErrorMessage } from './preparationWarehousePresentation';
import { usePreparationNotice } from './usePreparationNotice';

type Material = NonNullable<ReturnType<typeof usePreparationContext>['home']['snapshot']>['materials'][number];
type StockInput = { title: string; label: string; quantity?: boolean; save: (value: string) => void };

function WarehouseOption({ name, select, actions }: { name: string; select: () => void; actions?: () => void }) {
  return <Button label={name} modifiers={actions ? [onLongPressGesture(actions)] : []} onPress={select} />;
}

// @v2 PreparationWarehouseScreen
export function PreparationWarehouse() {
  const { home, session } = usePreparationContext();
  const t = usePreparationText(), sheet = useNativeSheet(), actions = useNativeSheet(), notice = usePreparationNotice();
  const [query, setQuery] = useState(''), [managing, setManaging] = useState(false), [expanded, setExpanded] = useState(false);
  const [showCreate, setShowCreate] = useState(false), [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [input, setInput] = useState<StockInput | null>(null);
  const afterAction = useRef<(() => void) | null>(null);
  const { snapshot, warehouse, controller } = home;
  useFocusEffect(useCallback(() => { void controller.loadForPage(); }, [controller]));
  const mode = preparationReceiptMode(warehouse, snapshot?.material_warehouses ?? []);
  const items = preparationVisibleMaterials(snapshot?.materials ?? [], warehouse, query);
  const blocked = home.locked || managing;
  const submit = (kind: string, payload: Record<string, unknown>) => {
    void controller.submit(kind, payload).then(() => notice.show(t('Saqlandi'))).catch(error => notice.show(String(error)));
  };
  const receive = (material: Material) => {
    if (!warehouse) return;
    setInput({ title: `${material.name} — kirim`, label: 'Kirim (kg)', quantity: true,
      save: kg => submit('receipts', preparationReceiptPayload(material, warehouse, kg)) });
  };
  const createMaterial = () => {
    if (!warehouse) return;
    setInput({ title: 'Yangi homashyo', label: 'Homashyo nomi', save: name => submit('materials', { name, warehouse }) });
  };
  const pickReceipt = () => {
    let selected: Material | null = null;
    sheet.open(<PreparationSeriyoPicker title="Homashyo tanlang" materials={items}
      subtitle={item => `Mavjud: ${preparationDisplay(preparationMaterialAvailable(item, warehouse))} kg`}
      choose={material => { selected = material; sheet.close(); }} />, { dismissible: true, onDismiss: () => { if (selected) receive(selected); } });
  };
  const manage = async (operation: () => Promise<void>) => {
    setManaging(true); try { await operation(); } finally { setManaging(false); }
  };
  const failure = (error: unknown) => notice.show(t(preparationWarehouseErrorMessage(error)));
  const createWarehouse = (name: string, parent: string) => { setShowCreate(false); void manage(async () => {
    const saved = await preparationCreateWarehouse(session, name, parent);
    if (!saved) return;
    await controller.reload(); controller.selectWarehouse(saved); setExpanded(false);
    notice.show(t(`Ombor ochildi: ${saved}`));
  }).catch(failure); };
  const rename = (name: string, value: string) => { void manage(async () => {
    const wasSelected = controller.getSnapshot().warehouse === name;
    const saved = await preparationRenameWarehouse(session, name, value); await controller.reload();
    if (wasSelected) controller.selectWarehouse(saved);
    notice.show(t('Ombor nomi o‘zgartirildi'));
  }).catch(failure); };
  const remove = (name: string) => Alert.alert(t('Omborni o‘chirish'), t(preparationWarehouseDeleteMessage(name)), [
    { text: t('Bekor qilish'), style: 'cancel' },
    { text: t('O‘chirish'), style: 'destructive', onPress: () => { void manage(async () => {
      const wasSelected = controller.getSnapshot().warehouse === name;
      await preparationDeleteWarehouse(session, name); await controller.reload();
      if (wasSelected) {
        const remaining = controller.getSnapshot().snapshot?.assigned_warehouses ?? [];
        if (remaining[0]) controller.selectWarehouse(remaining[0]);
      }
      notice.show(t('Ombor o‘chirildi'));
    }).catch(failure); } },
  ]);
  const openActions = (name: string) => {
    if (blocked || !snapshot?.managed_warehouses.includes(name)) return;
    actions.open(<Host matchContents={{ vertical: true }}><VStack spacing={12}>
      <Text>{name}</Text>
      <Button label={t('Nomini o‘zgartirish')} onPress={() => { afterAction.current = () => setRenameTarget(name); actions.close(); }} />
      <Button label={t('O‘chirish')} role="destructive" onPress={() => { afterAction.current = () => remove(name); actions.close(); }} />
    </VStack></Host>, { compact: true, dismissible: true, onDismiss: () => {
      const next = afterAction.current; afterAction.current = null; next?.();
    } });
  };
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Ombor') }} /><PreparationList refresh={controller.reload.bind(controller)}>
    <PreparationStatus loading={home.loading} error={home.error} retry={() => { void controller.reload(); }} />
    <Section>{!!snapshot?.assigned_warehouses.length && <Button label={`${t('Ombor')}: ${warehouse ?? t('Tanlanmagan')}`} onPress={() => setExpanded(value => !value)} />}
      {expanded && (snapshot?.assigned_warehouses ?? []).map(name => <WarehouseOption key={name} name={name}
        actions={snapshot?.managed_warehouses.includes(name) && !blocked ? () => openActions(name) : undefined}
        select={() => { controller.selectWarehouse(name); setExpanded(false); }} />)}
      <TextField placeholder={t('Qidirish')} onTextChange={setQuery} /></Section>
    {snapshot?.assigned_warehouses.length === 0 && <Section><Text>{t('Sizga ombor biriktirilmagan.')}</Text></Section>}
    {snapshot && snapshot.assigned_warehouses.length > 0 && !warehouse && <Section><Text>{t('Yuqoridagi filtrdan ombor tanlang.')}</Text></Section>}
    {warehouse && <Section>
      {items.length === 0 && <Text>{t('Bu omborda hali kirim yo‘q.')}</Text>}
      {items.map(material => <Button key={material.code} onPress={() => router.push(`/ios-preparation/material-detail?code=${encodeURIComponent(material.code)}&warehouse=${encodeURIComponent(warehouse)}` as Href)}>
        <Text>{material.name.trim() || material.code} · {t('Mavjud qoldiq')}: {preparationDisplay(preparationMaterialAvailable(material, warehouse))} kg</Text>
      </Button>)}
    </Section>}
    <Section title={t('Amallar')}>
      {mode === 'manual' && <Button label={t('Kirim')} modifiers={[disabled(blocked)]} onPress={pickReceipt} />}
      {mode === 'scale' && <Button label={t('Tarozi kirimi')} modifiers={[disabled(blocked)]} onPress={() => openPreparationScale({ warehouse })} />}
      {mode === 'manual' && <Button label={t('Homashyo qo‘shish')} modifiers={[disabled(blocked)]} onPress={createMaterial} />}
      {!!snapshot?.assigned_warehouses.length && !!snapshot?.material_warehouses.length && <Button label={t('Ombor qo‘shish')}
        modifiers={[disabled(blocked)]} onPress={() => setShowCreate(true)} />}
    </Section>
  </PreparationList><PreparationNotice message={notice.message} />
    {showCreate && snapshot && <PreparationWarehouseCreateDialog warehouses={snapshot.material_warehouses} selected={warehouse}
      close={() => setShowCreate(false)} create={createWarehouse} />}
    {renameTarget && <PreparationInputDialog key={renameTarget} title="Ombor nomini o‘zgartirish" label="Ombor nomi" initial={renameTarget}
      close={() => setRenameTarget(null)} save={value => { const target = renameTarget; setRenameTarget(null); rename(target, value); }} />}
    {input && <PreparationInputDialog title={input.title} label={input.label} quantity={input.quantity}
      close={() => setInput(null)} save={value => { const action = input.save; setInput(null); action(value); }} />}
  </View>;
}

// @v2 PreparationMaterialDetailScreen
export function PreparationMaterialDetail() {
  const params = useLocalSearchParams<{ code: string; warehouse?: string }>(), code = params.code;
  const { home } = usePreparationContext(), t = usePreparationText(), notice = usePreparationNotice();
  const [input, setInput] = useState<StockInput | null>(null);
  const { snapshot, controller } = home, warehouse = params.warehouse ?? home.warehouse;
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => { if (firstFocus.current) firstFocus.current = false; else void controller.reload(); }, [controller]));
  const material = snapshot?.materials.find(item => item.code === code);
  const history = preparationMaterialHistory(snapshot?.history ?? [], warehouse ?? '', code ?? '');
  const mode = preparationReceiptMode(warehouse, snapshot?.material_warehouses ?? []);
  const receive = () => {
    if (!warehouse || !material) return;
    setInput({ title: `${material.name} — kirim`, label: 'Kirim (kg)', quantity: true, save: kg => {
      void controller.submit('receipts', preparationReceiptPayload(material, warehouse, kg))
        .then(() => notice.show(t('Saqlandi'))).catch(error => notice.show(String(error)));
    } });
  };
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: material?.name ?? t('Homashyo') }} /><PreparationList refresh={controller.reload.bind(controller)}>
    <PreparationStatus loading={home.loading} error={home.error} retry={() => { void controller.reload(); }} />
    <Section>{!!warehouse && <Text>{warehouse}</Text>}{material && <><Text>{material.name}</Text><Text>{material.code}</Text>
      <Text>{preparationDisplay(preparationMaterialAvailable(material, warehouse))} kg</Text></>}
      {mode === 'manual' && <Button label={t('Kirim qilish')} modifiers={[disabled(home.locked || !material || !material.can_receive)]} onPress={receive} />}
      {mode === 'scale' && <Button label={t('Tarozi kirimi')} modifiers={[disabled(home.locked || !material)]} onPress={() => openPreparationScale({ warehouse })} />}</Section>
    {history.receipts.length > 0 && <Section title={t('Kirimlar')}>{history.receipts.map((item, index) => {
      const card = preparationMaterialReceiptCard(item, material?.name); return <VStack key={index} alignment="leading">
        <Text>{card.title}</Text><Text>{card.subtitle}</Text>{!!card.value && <Text>{card.value}</Text>}</VStack>;
    })}</Section>}
    {history.consumptions.length > 0 && <Section title={t('Chiqimlar')}>{history.consumptions.map(({ doc, line }, index) => {
      const card = preparationMaterialConsumptionCard(doc, line); return <VStack key={index} alignment="leading"><Text>{card.title}</Text><Text>{card.subtitle}</Text></VStack>;
    })}</Section>}
    {!history.receipts.length && !history.consumptions.length && <Section><Text>{t('Bu homashyo bo‘yicha hali kirim yoki chiqim yo‘q.')}</Text></Section>}
  </PreparationList><PreparationNotice message={notice.message} />
    {input && <PreparationInputDialog title={input.title} label={input.label} quantity={input.quantity}
      close={() => setInput(null)} save={value => { const action = input.save; setInput(null); action(value); }} />}
  </View>;
}
