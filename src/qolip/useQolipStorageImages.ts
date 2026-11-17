import { useEffect, useState } from 'react';
import { qolipCatalogId } from '../shared/qolipCatalogStore';
import { qolipRoleCatalogRuntimeFor } from './qolipRoleCatalogRuntime';
import { useQolipRole } from './QolipRoleContext';
import type { QolipStorageProductGroup } from './qolipStoragePresentation';

/** @v2 _StorageProductImages: optional covers reuse the source's one shared catalog window. */
export function useQolipStorageImages(groups: readonly QolipStorageProductGroup[]) {
  const { session, boundary, isCurrent } = useQolipRole();
  const [images, setImages] = useState<Readonly<Record<string, string>>>({});
  const wanted = JSON.stringify(groups.filter(group => !group.unlinked).map(group => ({ key: group.key, code: group.code })));
  useEffect(() => {
    const requested = JSON.parse(wanted) as { key: string; code: string }[];
    const store = qolipRoleCatalogRuntimeFor(session, boundary);
    let active = true, task: Promise<void> | null = null, requestedAgain = false;
    const current = () => active && isCurrent();
    const resolve = async () => {
      const seen = new Set<string>();
      while (current()) {
        const window = store.window(''), byId = new Map(window.items.map(item => [item.id, item]));
        const found: Record<string, string> = {}; let missing = false;
        for (const group of requested) {
          const item = byId.get(qolipCatalogId(group.code));
          if (item) found[group.key] = item.order_image_order_id.trim(); else missing = true;
        }
        if (!current()) return;
        setImages(previous => ({ ...previous, ...found }));
        if (!missing) return;
        if (!window.loaded) { await store.first(); continue; }
        if (window.nextCursor === null || seen.has(window.nextCursor)) return;
        seen.add(window.nextCursor); await store.more('');
      }
    };
    const request = () => {
      if (!current()) return;
      if (task) { requestedAgain = true; return; }
      task = resolve().catch(() => {}).finally(() => { task = null; if (requestedAgain && current()) { requestedAgain = false; request(); } });
    };
    const stop = store.subscribe(request); request();
    return () => { active = false; stop(); };
  }, [session, boundary, isCurrent, wanted]);
  return images;
}
