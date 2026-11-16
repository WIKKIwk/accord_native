import { useLayoutEffect, useMemo, useRef } from 'react';
import type { AdminWarehouseRawQrProviderModel } from './useAdminWarehouseRawQrProvider';

type Child = { id: number | null; close: (() => void) | null };
class DetailSurfaceOwner {
  private child: Child | null = null;
  constructor(private readonly show: AdminWarehouseRawQrProviderModel['open']) {}
  open: AdminWarehouseRawQrProviderModel['open'] = (...args) => {
    if (this.child) return Promise.resolve();
    const child: Child = { id: null, close: null }; this.child = child;
    try { return this.show(...args).finally(() => { if (this.child === child) this.child = null; }); }
    catch (error) { if (this.child === child) this.child = null; throw error; }
  };
  commit(model: AdminWarehouseRawQrProviderModel) {
    const child = this.child, value = model.presentation;
    if (!child || !value) return;
    if (child.id === null) child.id = value.id;
    if (child.id === value.id) child.close = model.close;
  }
  capture() { return this.child; }
  complete(child: Child | null) { if (child && this.child === child) child.close?.(); }
}

/** Bind issued children before their first native render, retaining original-id dismissal. */
export function useAdminWarehouseDetailSurfaceOwner(model: AdminWarehouseRawQrProviderModel) {
  const owner = useMemo(() => new DetailSurfaceOwner(model.open), [model.open]);
  useLayoutEffect(() => owner.commit(model), [owner, model]);
  return owner;
}

/** A removed parent sheet completes its original child, even when native dismissal has no callback. */
export function useAdminWarehouseDetailSurface(surface: ReturnType<typeof useAdminWarehouseDetailSurfaceOwner>) {
  const membership = useRef({ attachment: 0, attached: false });
  useLayoutEffect(() => {
    const owner = membership.current, attachment = ++owner.attachment; owner.attached = true;
    return () => {
      owner.attached = false;
      const child = surface.capture();
      queueMicrotask(() => { if (!owner.attached && owner.attachment === attachment) surface.complete(child); });
    };
  }, [surface]);
}
