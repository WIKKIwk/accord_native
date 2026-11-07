import { Column, Host, ListItem, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { clickable, clip, fillMaxWidth, Shapes } from '@expo/ui/jetpack-compose/modifiers';
import { router, type Href } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';
import { usePreparationContext } from './PreparationContext.android';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { RoleFabAction } from '../shared/navigation/RoleFab.android';
import { openPreparationScale } from './preparationNavigation.android';
import { PreparationButton, PreparationPage, PreparationRow, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { PreparationNotice } from './PreparationNotice';
import { PreparationSeriyoPicker } from './PreparationSeriyoPicker.android';
import { preparationMaterialAvailable, preparationReceiptMode, preparationReceiptPayload, preparationVisibleMaterials, type PreparationMaterial } from './preparationLogic';
import { preparationDisplay } from './preparationModel';
import { preparationPendingLabel } from './preparationHomePresentation';
import { usePreparationNotice } from './usePreparationNotice';

// @v2 PreparationScreen
export function PreparationHomeScreen() {
  const { home, session } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const colors = useMaterialColors();
  const sheet = useNativeSheet(), notice = usePreparationNotice();
  const submitting = useRef(false);
  const data = home.snapshot;
  const openScale = () => openPreparationScale({ warehouse: home.warehouse });
  const submit = async (kind: string, payload: Record<string, unknown>) => {
    if (submitting.current || home.controller.getSnapshot().saving) return;
    submitting.current = true;
    try { await home.controller.submit(kind, payload); notice.show(t('Saqlandi')); }
    catch (error) { notice.show(String(error)); }
    finally { submitting.current = false; }
  };
  const receive = () => {
    if (!data) { router.push('/android-preparation/warehouse' as Href); return; }
    const mode = preparationReceiptMode(home.warehouse, data.material_warehouses);
    if (mode === 'warehouse') { router.push('/android-preparation/warehouse' as Href); return; }
    if (mode === 'scale') { openScale(); return; }
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
  const fabActions: RoleFabAction[] = [
    { id: 'sets', label: t('Mahsulot formulasi'), icon: 'functions', width: 250 },
    { id: 'materials', label: t('Homashyolar'), icon: 'inventory_2', width: 210 },
    { id: 'warehouse', label: t('Ombor'), icon: 'warehouse', width: 164 },
    ...(canOpenRoute(session, appRoutes.gscaleMode) ? [{ id: 'scale', label: t('Tarozi kirimi'), icon: 'scale' as const, width: 210 }] : []),
    ...(preparationReceiptMode(home.warehouse, data?.material_warehouses ?? []) !== 'scale' ? [{ id: 'receive', label: t('Kirim'), icon: 'add_circle' as const, width: 164 }] : []),
    { id: 'sequence', label: t('Buyurtmalar'), icon: 'list_alt', width: 200 },
    { id: 'history', label: t('Tarix'), icon: 'history', width: 164 },
  ];
  const selectAction = (chosen: string) => {
    if (chosen === 'receive') receive();
    else if (chosen === 'scale') openScale();
    else if (chosen === 'warehouse') router.push('/android-preparation/warehouse' as Href);
    else if (chosen === 'materials') router.push('/android-preparation/materials' as Href);
    else if (chosen === 'sets') router.push('/android-preparation/sets' as Href);
    else if (chosen === 'sequence') router.replace('/android-preparation/sequence' as Href);
    else if (chosen === 'history') router.push('/android-preparation/history' as Href);
  };
  const menuItems = [
    { title: 'Ombor', onPress: () => router.push('/android-preparation/warehouse' as Href) },
    { title: 'Homashyolar', onPress: () => router.push('/android-preparation/materials' as Href) },
    { title: 'Mahsulot formulasi', onPress: () => router.push('/android-preparation/sets' as Href) },
    { title: 'Buyurtmalar', onPress: () => router.replace('/android-preparation/sequence' as Href) },
    { title: 'Ishlab chiqarish', onPress: () => router.replace('/android-preparation/production' as Href) },
    { title: 'Ishlab chiqarilgan homashyolar', onPress: () => router.push('/android-preparation/inventory' as Href) },
    { title: 'Tarix', onPress: () => router.push('/android-preparation/history' as Href) },
  ];
  return <View style={{ flex: 1 }}><PreparationPage title="Tayyorlov masteri" subtitle="Ichki homashyo ta’minoti" root drawer fabActions={fabActions} onFabSelect={selectAction}>
    <View style={{ marginHorizontal: -8 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[fillMaxWidth()]}>
        {menuItems.map((item, index) => <ListItem key={item.title} colors={{ containerColor: colors.surface }} modifiers={[
          fillMaxWidth(),
          clip(Shapes.RoundedCorner({ topStart: index === 0 ? 16 : 4, topEnd: index === 0 ? 16 : 4,
            bottomStart: index === menuItems.length - 1 ? 16 : 4, bottomEnd: index === menuItems.length - 1 ? 16 : 4 })),
          clickable(item.onPress),
        ]}>
          <ListItem.HeadlineContent><Text style={{ typography: 'bodyLarge', fontWeight: '500' }}>{t(item.title)}</Text></ListItem.HeadlineContent>
        </ListItem>)}
      </Column>
    </Host></View>
    {home.pending ? <PreparationRow title={t('Tasdiqlanmagan operatsiya')}
      subtitle={preparationPendingLabel(home.pending)} /> : null}
    {home.pending ? <PreparationButton label="Tekshirish" disabled={home.saving || home.loading} onPress={() => {
      if (home.pending) void submit(home.pending.kind, home.pending.payload);
    }} /> : null}
  </PreparationPage><PreparationNotice message={notice.message} /></View>;
}
