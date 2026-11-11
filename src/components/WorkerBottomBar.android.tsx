import { useWorkerOrderText } from './useWorkerOrderText';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';

type Props = { active: string; onSelect: (id: string) => void; onScan: () => void };
const items: RoleNavigationItem[] = [
  { id: 'home', label: 'Uy', icon: 'home' },
  { id: 'profile', label: 'Profil', icon: 'person' },
  { id: 'chat', label: 'Chat', icon: 'chat_bubble' },
];

export function WorkerBottomBar({ active, onSelect }: Props) {
  const { t } = useWorkerOrderText();
  return <RoleBottomBar active={active} items={items.map(item => ({ ...item, label: t(item.label) }))} onSelect={onSelect} />;
}
