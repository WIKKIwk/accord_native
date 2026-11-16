import type { AdminApparatus } from '../apparatusApi';
import type { qolipProductFromJson } from '../qolipCatalogApi';
import type { RawMaterialStock } from '../shared/printApi';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import type { AdminWarehouseSummary } from './warehouseApi';

export type AdminWarehouseMainProfileFlags = Readonly<{ warehouseScoped: boolean; adminScoped: boolean }>;
export type AdminWarehouseMainSummary = { sections: AdminWarehouseSummary[]; qolipWarehouseNames: string[] };
export type AdminWarehouseMainDetail = { rawStock: RawMaterialStock[]; reservations: AdminRawMaterialAssignment[]; apparatus: AdminApparatus[] };
export type AdminWarehouseMainQolipProduct = ReturnType<typeof qolipProductFromJson>;
export type AdminWarehouseMainReadGuard = () => void;
export type AdminWarehouseMainReadWitness = () => boolean;
