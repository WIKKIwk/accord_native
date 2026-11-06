import type { Href } from 'expo-router';
import { Button, Menu, Section, Text } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { PreparationInputDialog } from './PreparationInputDialog';
import { PreparationNotice } from './PreparationNotice';
import { PreparationSeriyoPicker } from './PreparationSeriyoPicker';
import { PreparationList, PreparationStatus, usePreparationText } from './PreparationUI';
import { usePreparationContext } from './PreparationContext';
import { preparationMaterialAvailable, preparationReceiptMode, preparationReceiptPayload, preparationVisibleMaterials, type PreparationMaterial } from './preparationLogic';
import { preparationDisplay } from './preparationModel';
import { preparationPendingLabel } from './preparationHomePresentation';
import { openPreparationScale } from './PreparationRoutes';
import { usePreparationNotice } from './usePreparationNotice';

// @v2 PreparationScreen
export function PreparationHome() {
  const { home, session } = usePreparationContext();
  const t = usePreparationText(), sheet = useNativeSheet(), firstFocus = useRef(true), notice = usePreparationNotice();
  const [receipt, setReceipt] = useState<PreparationMaterial | null>(null);
  const { snapshot, controller, warehouse, locked } = home;
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) firstFocus.current = false;
    else void controller.reload();
  }, [controller]));
  const submit = (kind: string, payload: Record<string, unknown>) => {
    if (controller.getSnapshot().saving) return;
    void controller.submit(kind, payload).then(() => notice.show(t('Saqlandi'))).catch(error => notice.show(String(error)));
  };
  const mode = preparationReceiptMode(warehouse, snapshot?.material_warehouses ?? []);
  const receivable = preparationVisibleMaterials(snapshot?.materials ?? [], warehouse).filter(item => item.can_receive);
  const startReceipt = () => {
    if (mode === 'warehouse') { router.push('/ios-preparation/warehouse' as Href); return; }
    if (mode === 'scale') { openPreparationScale({ warehouse }); return; }
    let selected: PreparationMaterial | null = null;
    const subtitle = (item: PreparationMaterial) => `Mavjud: ${preparationDisplay(preparationMaterialAvailable(item, warehouse))} kg`;
    sheet.open(<PreparationSeriyoPicker title="Homashyo tanlang" materials={receivable} subtitle={subtitle}
      searchText={item => `${item.name} ${subtitle(item)}`} choose={material => { selected = material; sheet.close(); }} />,
    { dismissible: true, onDismiss: () => { if (selected) setReceipt(selected); } });
  };
  const stockLocked = disabled(locked || !snapshot);
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Tayyorlov masteri') }} /><PreparationList refresh={controller.reload.bind(controller)}>
    <PreparationStatus loading={home.loading} error={home.error} retry={() => { void controller.reload(); }} />
    {home.pending && <Section title={t('Tasdiqlanmagan operatsiya')}>
      <Text>{preparationPendingLabel(home.pending)}</Text>
      <Button label={t('Tekshirish')} modifiers={[disabled(home.loading || home.saving)]} onPress={() => {
        submit(home.pending!.kind, home.pending!.payload);
      }} />
    </Section>}
    {snapshot && snapshot.assigned_warehouses.length === 0 && <Section><Text>{t('Sizga ombor biriktirilmagan. Admin foydalanuvchi kartasidan ombor biriktirishi kerak.')}</Text></Section>}
    {snapshot && <Section>
      {!!snapshot?.assigned_warehouses.length && <Button label={`${t('Ombor')}${warehouse ? `: ${warehouse}` : ''}`} systemImage="building.2" modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/warehouse' as Href)} />}
      <Button label={t('Homashyolar')} systemImage="shippingbox" modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/materials' as Href)} />
      <Button label={t('Mahsulot formulasi')} systemImage="list.bullet.rectangle" modifiers={[stockLocked]} onPress={() => router.push('/ios-preparation/sets' as Href)} />
      <Button label={t('Buyurtmalar')} systemImage="list.number" onPress={() => router.push('/ios-preparation/sequence' as Href)} />
      <Button label={t('Ishlab chiqarish')} systemImage="chart.bar" onPress={() => router.replace('/ios-preparation/production' as Href)} />
      <Button label={t('Ishlab chiqarilgan homashyolar')} systemImage="shippingbox" onPress={() => router.push('/ios-preparation/inventory' as Href)} />
      <Button label={t('Tarix')} systemImage="clock.arrow.circlepath" onPress={() => router.push('/ios-preparation/history' as Href)} />
    </Section>}
    {snapshot && <Section><Menu label={t('Amallar')} systemImage="plus.circle">
      {!locked && <Button label={t('Mahsulot formulasi')} onPress={() => router.push('/ios-preparation/sets' as Href)} />}
      {!locked && <Button label={t('Homashyolar')} onPress={() => router.push('/ios-preparation/materials' as Href)} />}
      <Button label={t('Ombor')} onPress={() => router.push('/ios-preparation/warehouse' as Href)} />
      {canOpenRoute(session, appRoutes.gscaleMode) && <Button label={t('Tarozi kirimi')} onPress={() => openPreparationScale({ warehouse })} />}
      {mode !== 'scale' && <Button label={t('Kirim')} onPress={startReceipt} />}
      <Button label={t('Buyurtmalar')} onPress={() => router.push('/ios-preparation/sequence' as Href)} />
      <Button label={t('Tarix')} onPress={() => router.push('/ios-preparation/history' as Href)} />
    </Menu></Section>}
  </PreparationList><PreparationNotice message={notice.message} />
    {receipt && warehouse && <PreparationInputDialog title={`${receipt.name} — kirim`} label="Kirim (kg)" quantity
      close={() => setReceipt(null)} save={kg => { const material = receipt; setReceipt(null); submit('receipts', preparationReceiptPayload(material, warehouse, kg)); }} />}
  </View>;
}
