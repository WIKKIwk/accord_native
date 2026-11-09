import type { AdminApparatus } from '../apparatusApi';
import type { AdminWorkMapModule } from './adminWorkMapController';
export type AdminWorkMapControlsProps = { module: AdminWorkMapModule; catalog: readonly AdminApparatus[]; selected: AdminApparatus | null;
  expanded: boolean; onToggle: () => void; onModule: (module: AdminWorkMapModule) => void; onApparatus: (id: string) => void;
  apparatusLabel: string; unselectedLabel: string; countText: string };
