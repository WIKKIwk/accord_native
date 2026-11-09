import { QolipHomeOwner } from './QolipHomeOwner';
import type { QolipHomeOwnerProps } from './qolipHomeOwnerProps';
import { useQolipSettledHomeSession } from './useQolipSettledHomeSession';

type Props = Omit<QolipHomeOwnerProps, 'session' | 'boundary'>;

// Not routed. Real, independently reviewed actions remain mandatory before this shell may be exposed.
export function QolipSettledHomeShell(props: Props) {
  const entry = useQolipSettledHomeSession();
  if (entry.kind !== 'ready') return null;
  return <QolipHomeOwner {...props} session={entry.session} boundary={entry.boundary} />;
}
