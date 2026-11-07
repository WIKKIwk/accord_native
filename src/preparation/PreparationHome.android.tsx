import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { usePreparationContext } from './PreparationContext.android';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { openPreparationScale } from './preparationNavigation.android';
import { PreparationButton, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { PreparationNotice } from './PreparationNotice';
import { PreparationSeriyoPicker } from './PreparationSeriyoPicker.android';
import { preparationMaterialAvailable, preparationReceiptMode, preparationReceiptPayload, preparationVisibleMaterials, type PreparationMaterial } from './preparationLogic';
import { preparationDisplay } from './preparationModel';
import { preparationPendingLabel } from './preparationHomePresentation';
import { usePreparationNotice } from './usePreparationNotice';

// @v2 PreparationScreen
export function PreparationHomeScreen() {
  const { home, session } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const sheet = useNativeSheet(), notice = usePreparationNotice();
  const submitting = useRef(false);
  useFocusEffect(useCallback(() => {
    void home.controller.refreshOnReturn();
  }, [home.controller]));
  const data = home.snapshot;
  const openWithReload = (path: Href) => { home.controller.markReloadOnReturn(); router.push(path); };
  const openScaleWithReload = () => { home.controller.markReloadOnReturn(); openPreparationScale({ warehouse: home.warehouse }); };
  const submit = async (kind: string, payload: Record<string, unknown>) => {
    if (submitting.current || home.controller.getSnapshot().saving) return;
    submitting.current = true;
    try { await home.controller.submit(kind, payload); notice.show(t('Saqlandi')); }
    catch (error) { notice.show(String(error)); }
    finally { submitting.current = false; }
  };
  const receive = () => {
    if (!data) return;
    const mode = preparationReceiptMode(home.warehouse, data.material_warehouses);
    if (mode === 'warehouse') { openWithReload('/android-preparation/warehouse' as Href); return; }
    if (mode === 'scale') { openScaleWithReload(); return; }
    const materials = preparationVisibleMaterials(data.materials, home.warehouse).filter(item => item.can_receive);
    const warehouse = home.warehouse;
    if (!warehouse) return;
    let selected: PreparationMaterial | null = null;
    const subtitle = (item: PreparationMaterial) => `Mavjud: ${preparationDisplay(preparationMaterialAvailable(item, warehouse))} kg`;
    sheet.open(<PreparationSeriyoPicker title="Homashyo tanlang" materials={materials} subtitle={subtitle}
      searchText={item => `${item.name} ${subtitle(item)}`} choose={material => { selected = material; sheet.close(); }} />,
    { dismissible: true, onDismiss: () => {
      const material = selected;
      if (!material) return;
      void (async () => {
        const kg = await dialogs.input({ title: `${material.name} — kirim`, label: 'Kirim (kg)', quantity: true });
        if (kg !== null) await submit('receipts', preparationReceiptPayload(material, warehouse, kg));
      })();
    } });
  };
  const actions = async () => {
    if (!data) return;
    const chosen = await dialogs.choose('Amallar', [
      ...(!home.locked ? [{ label: 'Mahsulot formulasi', value: 'sets' }, { label: 'Homashyolar', value: 'materials' }] : []),
      { label: 'Ombor', value: 'warehouse' },
      ...(canOpenRoute(session, appRoutes.gscaleMode) ? [{ label: 'Tarozi kirimi', value: 'scale' }] : []),
      ...(preparationReceiptMode(home.warehouse, data.material_warehouses) !== 'scale' ? [{ label: 'Kirim', value: 'receive' }] : []),
      { label: 'Buyurtmalar', value: 'sequence' },
      { label: 'Tarix', value: 'history' },
    ]);
    if (chosen === 'receive') receive();
    else if (chosen === 'scale') openScaleWithReload();
    else if (chosen === 'warehouse') openWithReload('/android-preparation/warehouse' as Href);
    else if (chosen === 'materials') openWithReload('/android-preparation/materials' as Href);
    else if (chosen === 'sets') openWithReload('/android-preparation/sets' as Href);
    else if (chosen === 'sequence') router.replace('/android-preparation/sequence' as Href);
    else if (chosen === 'history') openWithReload('/android-preparation/history' as Href);
  };
  return <View style={{ flex: 1 }}><PreparationPage title="Tayyorlov masteri" subtitle="Ichki homashyo ta’minoti" root drawer actions={data ? () => void actions() : undefined} refreshing={home.refreshing}
    onRefresh={() => { void home.controller.refresh(); }}>
    {home.loading && !data ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View> : <>
    {home.error ? <PreparationRow title={t('Xatolik yuz berdi')} subtitle={home.error} /> : null}
    {data && !data.assigned_warehouses.length ? <PreparationText>{t('Sizga ombor biriktirilmagan. Admin foydalanuvchi kartasidan ombor biriktirishi kerak.')}</PreparationText> : null}
    {home.pending ? <PreparationRow title={t('Tasdiqlanmagan operatsiya')}
      subtitle={preparationPendingLabel(home.pending)} /> : null}
    {home.pending ? <PreparationButton label="Tekshirish" disabled={home.saving || home.loading} onPress={() => {
      if (home.pending) void submit(home.pending.kind, home.pending.payload);
    }} /> : null}
    {data ? <>
      {!!data.assigned_warehouses.length && <PreparationRow title={t('Ombor')} subtitle={home.warehouse ?? undefined} disabled={home.locked} onPress={() => openWithReload('/android-preparation/warehouse' as Href)} />}
      <PreparationRow title={t('Homashyolar')} disabled={home.locked} onPress={() => openWithReload('/android-preparation/materials' as Href)} />
      <PreparationRow title={t('Mahsulot formulasi')} disabled={home.locked} onPress={() => openWithReload('/android-preparation/sets' as Href)} />
      <PreparationRow title={t('Buyurtmalar')} onPress={() => router.replace('/android-preparation/sequence' as Href)} />
      <PreparationRow title={t('Ishlab chiqarish')} onPress={() => router.replace('/android-preparation/production' as Href)} />
      <PreparationRow title={t('Ishlab chiqarilgan homashyolar')} onPress={() => router.push('/android-preparation/inventory' as Href)} />
      <PreparationRow title={t('Tarix')} onPress={() => openWithReload('/android-preparation/history' as Href)} />
    </> : null}
    </>}
  </PreparationPage><PreparationNotice message={notice.message} /></View>;
}
