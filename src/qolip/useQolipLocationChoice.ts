import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';
import type { QolipLocationChoiceProps } from './qolipLocationChoiceProps';

export function useQolipLocationChoice(props: QolipLocationChoiceProps) {
  const lifetime = useMemo(() => new QolipLocationChoiceLifetime(props.boundary), [props.boundary]);
  const valid = useSyncExternalStore(lifetime.subscribe, lifetime.getSnapshot, lifetime.getSnapshot);
  useLayoutEffect(() => { lifetime.activate(); return () => lifetime.suspend(); }, [lifetime]);
  return { valid, choose: (item: Parameters<QolipLocationChoiceProps['choose']>[0]) => {
    if (lifetime.canChoose()) props.choose(item);
  } };
}
