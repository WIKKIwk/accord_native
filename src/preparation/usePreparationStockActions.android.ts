import { usePreparationContext } from './PreparationContext.android';
import { preparationReceiptMode, preparationReceiptPayload, type PreparationMaterial } from './preparationLogic';
import { usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import type { usePreparationNotice } from './usePreparationNotice';

export function usePreparationStockActions(notice: ReturnType<typeof usePreparationNotice>) {
  const { home } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const receive = async (material: PreparationMaterial, selectedWarehouse = home.warehouse) => {
    if (!selectedWarehouse || !home.snapshot || home.locked) return;
    if (preparationReceiptMode(selectedWarehouse, home.snapshot.material_warehouses) !== 'manual') return;
    const kg = await dialogs.input({ title: `${material.name} — kirim`, label: 'Kirim (kg)', quantity: true });
    if (kg === null) return;
    try { await home.controller.submit('receipts', preparationReceiptPayload(material, selectedWarehouse, kg)); notice.show(t('Saqlandi')); }
    catch (error) { notice.show(String(error)); }
  };
  const createMaterial = async () => {
    if (!home.warehouse || home.locked) return;
    const name = await dialogs.input({ title: 'Yangi homashyo', label: 'Homashyo nomi' });
    if (name === null) return;
    try { await home.controller.submit('materials', { name, warehouse: home.warehouse }); notice.show(t('Saqlandi')); }
    catch (error) { notice.show(String(error)); }
  };
  return { receive, createMaterial };
}
