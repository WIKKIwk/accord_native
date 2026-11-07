import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';

type Props = { active: string; onSelect: (id: string) => void; onScan: () => void };
const items: RoleNavigationItem[] = [
  { id: 'home', label: 'Asosiy', icon: 'home' },
  { id: 'profile', label: 'Profil', icon: 'person' },
  { id: 'chat', label: 'Chat', icon: 'chat_bubble' },
];

export function WorkerBottomBar({ active, onSelect }: Props) {
  return <RoleBottomBar active={active} items={items} onSelect={onSelect} />;
}
