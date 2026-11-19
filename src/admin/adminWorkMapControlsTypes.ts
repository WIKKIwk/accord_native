import type { AdminApparatus } from '../apparatusApi';
import type { AdminWorkMapModule } from './adminWorkMapController';
export const adminWorkMapTabs = [
  { id: 'sequence', name: 'Ketma-ketlik' },
  { id: 'orders', name: 'Buyurtmalar' },
  { id: 'move', name: 'Ko‘chirish' },
  { id: 'closed', name: 'Yopilgan' },
  { id: 'audit', name: 'Tekshiruv' },
] as const satisfies readonly { id: AdminWorkMapModule; name: string }[];

export type AdminWorkMapControlsProps = { module: AdminWorkMapModule; catalog: readonly AdminApparatus[]; selected: AdminApparatus | null;
  expanded: boolean; onToggle: () => void; onModule: (module: AdminWorkMapModule) => void; onApparatus: (id: string) => void;
  apparatusLabel: string; unselectedLabel: string; countText: string };
