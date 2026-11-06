import { WorkerControlException } from '../workerControlsApi';

export function preparationWarehouseParent(warehouses: readonly string[], selected: string | null) {
  return selected !== null && warehouses.includes(selected) ? selected : warehouses[0] ?? null;
}

export function preparationWarehouseDeleteMessage(warehouse: string) {
  return `«${warehouse}» ombori o‘chirilsinmi? Ichida homashyo yoki bog‘langan yozuvlar bo‘lsa, o‘chirilmaydi.`;
}

export function preparationWarehouseErrorMessage(error: unknown) {
  return error instanceof WorkerControlException ? error.message
    : 'Ombor bilan amal bajarilmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring';
}
