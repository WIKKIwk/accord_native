import type { Href } from 'expo-router';
import { Button, Menu, Section, Text } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { PreparationInputSheet, PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { usePreparationContext } from './PreparationContext';
import { preparationReceiptMode, preparationReceiptPayload, preparationVisibleMaterials } from './preparationLogic';
import { openPreparationScale } from './PreparationRoutes';

// @v2 PreparationScreen
export function PreparationHome() {
  const { home, session } = usePreparationContext();
  const t = usePreparationText(), sheet = useNativeSheet(), firstFocus = useRef(true);
  const { snapshot, controller, warehouse, locked } = home;
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) firstFocus.current = false;
    else void controller.reload();
  }, [controller]));
  const submit = async (kind: string, payload: Record<string, unknown>) => {
    await controller.submit(kind, payload); Alert.alert(t('Saqlandi'));
  };
  const createMaterial = () => {
    if (!warehouse) return;
    sheet.open(<PreparationInputSheet title="Yangi homashyo" label="Homashyo nomi" close={sheet.close}
      save={name => submit('materials', { name, warehouse })} />, { compact: true, dismissible: false });
  };
  const receive = (material: NonNullable<typeof snapshot>['materials'][number]) => {
    if (!warehouse) return;
    sheet.open(<PreparationInputSheet title={`${material.name} — kirim`} label="Kirim (kg)" quantity close={sheet.close}
      save={kg => submit('receipts', preparationReceiptPayload(material, warehouse, kg))} />, { compact: true, dismissible: false });
  };
  const mode = preparationReceiptMode(warehouse, snapshot?.material_warehouses ?? []);
  const receivable = preparationVisibleMaterials(snapshot?.materials ?? [], warehouse).filter(item => item.can_receive);
  const stockLocked = disabled(locked || !snapshot);
  return <><Stack.Screen options={{ title: t('Tayyorlov masteri') }} /><PreparationList refresh={controller.reload.bind(controller)}>
    <Section><Text>{t('Ichki homashyo ta’minoti')}</Text></Section>
    <PreparationStatus loading={home.loading} error={home.error} retry={() => { void controller.reload(); }} />
    {home.pending && <Section title={t('Tasdiqlanmagan operatsiya')}>
      <Text>{String(home.pending.payload.kg ?? '')} {String(home.pending.payload.name ?? home.pending.payload.item_code ?? home.pending.payload.order_id ?? '')}</Text>
      <Button label={t('Tekshirish')} modifiers={[disabled(home.loading || home.saving)]} onPress={() => {
        void submit(home.pending!.kind, home.pending!.payload).catch(preparationAlert);
      }} />
    </Section>}
    {snapshot && snapshot.assigned_warehouses.length === 0 && <Section><Text>{t('Sizga ombor biriktirilmagan. Admin foydalanuvchi kartasidan ombor biriktirishi kerak.')}</Text></Section>}
    <Section>
      <Button label={t('Ombor')} systemImage="building.2" modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/warehouse' as Href)} />
      <Button label={t('Homashyolar')} systemImage="shippingbox" modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/materials' as Href)} />
      <Button label={t('Mahsulot formulasi')} systemImage="list.bullet.rectangle" modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/sets' as Href)} />
      <Button label={t('Buyurtmalar')} systemImage="list.number" onPress={() => router.replace('/ios-preparation/sequence' as Href)} />
      <Button label={t('Ishlab chiqarish')} systemImage="chart.bar" onPress={() => router.replace('/ios-preparation/production' as Href)} />
      {canOpenRoute(session, appRoutes.inventoryMovements) && <Button label={t('Ishlab chiqarilgan homashyolar')} systemImage="shippingbox" onPress={() => router.push('/ios-preparation/inventory' as Href)} />}
      <Button label={t('Tarix')} systemImage="clock.arrow.circlepath" onPress={() => router.push('/ios-preparation/history' as Href)} />
    </Section>
    <Section><Menu label={t('Amallar')} systemImage="plus.circle">
      <Button label={t('Ombor')} modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/warehouse' as Href)} />
      <Button label={t('Homashyolar')} modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/materials' as Href)} />
      <Button label={t('Mahsulot formulasi')} modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/sets' as Href)} />
      <Button label={t('Buyurtmalar')} onPress={() => router.replace('/ios-preparation/sequence' as Href)} />
      <Button label={t('Tarix')} onPress={() => router.push('/ios-preparation/history' as Href)} />
      {canOpenRoute(session, appRoutes.gscaleMode) && <Button label={t('Tarozi kirimi')} modifiers={[stockLocked]} onPress={() => openPreparationScale({ warehouse })} />}
      {mode === 'manual' && <Menu label={t('Kirim')} modifiers={[stockLocked]}>
        {receivable.map(material => <Button key={material.code} label={material.name} onPress={() => receive(material)} />)}
      </Menu>}
      {mode === 'warehouse' && <Button label={t('Kirim')} modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/warehouse' as Href)} />}
      {mode === 'scale' && <Button label={t('Kirim')} modifiers={[stockLocked]} onPress={() => openPreparationScale({ warehouse })} />}
      {mode === 'manual' && <Button label={t('Homashyo qo‘shish')} modifiers={[stockLocked]} onPress={createMaterial} />}
    </Menu></Section>
  </PreparationList></>;
}
