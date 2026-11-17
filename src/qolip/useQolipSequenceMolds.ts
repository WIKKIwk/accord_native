import { useEffect, useRef, useState } from 'react';
import { qolipProductMolds } from '../qolipCatalogApi';
import { qolipProducts } from '../qolipProductsApi';
import { adminText } from '../shared/localization';
import { MobileApiException } from '../shared/mobileApiException';
import { WorkerControlException } from '../workerControlsApi';
import type { productionMapSavedFromJson } from '../workerProductionMapSaved';
import { useQolipRole } from './QolipRoleContext';
import { qolipSequenceMolds, type QolipSequenceMold } from './qolipSequenceMolds';
import { useQolipCatalogEditors } from './useQolipCatalogEditors';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { useQolipText } from './useQolipText';
export type QolipSequenceOrder = ReturnType<typeof productionMapSavedFromJson>;
export function useQolipSequenceMolds(order: QolipSequenceOrder) {
  const role = useQolipRole(), boundary = useQolipPassiveBoundary(role.boundary), { locale } = useQolipText(), editors = useQolipCatalogEditors();
  const [items, setItems] = useState<QolipSequenceMold[]>([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), sending = useRef(false);
  const text = (key: string) => adminText(`production.qolip_${key}`, locale);
  const message = (reason: unknown, fallback: string) => reason instanceof MobileApiException || reason instanceof WorkerControlException ? reason.message : text(fallback);
  const load = async () => {
    const id = ++generation.current; if (!boundary.isCurrent()) return;
    setLoading(true); setError('');
    try { const code = order.map.product_code.trim(), products = code ? await qolipProductMolds(role.session, code, boundary.isCurrent) : [];
      if (id === generation.current && boundary.isCurrent()) setItems(qolipSequenceMolds(products));
    } catch (reason) { if (id === generation.current && boundary.isCurrent()) setError(message(reason, 'load_failed')); }
    finally { if (id === generation.current && boundary.isCurrent()) setLoading(false); }
  };
  useEffect(() => { const counter = generation; void Promise.resolve().then(() => { if (boundary.isCurrent()) return load(); }); return () => { counter.current++; }; }, [order.map.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    if (sending.current || !boundary.isCurrent()) return;
    sending.current = true; setSaving(true);
    try {
      const products = await qolipProducts(role.session, { query: order.map.product_code, limit: 50 }, boundary.isCurrent);
      if (!boundary.isCurrent()) return;
      const product = products.find(item => item.code.trim().toLowerCase() === order.map.product_code.trim().toLowerCase());
      if (!product) { setError(text('product_missing')); return; }
      if (!product.item_group.trim()) { setError(text('group_missing')); return; }
      await editors.openSpec({ initialProduct: product, lockProduct: true, closeAfterSave: true });
      if (boundary.isCurrent()) await load();
    } catch (reason) { if (boundary.isCurrent()) setError(message(reason, 'add_failed')); }
    finally { sending.current = false; if (boundary.isCurrent()) setSaving(false); }
  };
  return { valid: boundary.valid, items, loading, saving, error, text, content: editors.content, add: () => { void add(); } };
}
