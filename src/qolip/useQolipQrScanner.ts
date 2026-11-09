import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { qolipRoleReadBoundary } from './qolipRoleReadBoundary';
import { qolipCellQrLookup } from './qolipQrApi';
import { QolipQrScannerState, qolipScannerModeKey, type QolipQrScannerMode, type QolipQrScannerResult } from './qolipQrScannerState';
import { useQolipQrCamera } from './useQolipQrCamera';
import { useQolipNotice } from './useQolipNotice';
import { useQolipText } from './useQolipText';

export type QolipQrScannerProps = { session: Session; boundary: QolipHomeReadBoundary; mode: QolipQrScannerMode;
  onClose(): void; onResult(result: QolipQrScannerResult): void };

/** One mounted scanner page, bound to its original role witness. */
export function useQolipQrScanner({ session, boundary, mode, onClose, onResult }: QolipQrScannerProps) {
  const [original] = useState(() => ({ session, boundary, mode, role: qolipRoleReadBoundary(session, boundary) }));
  const focus = useRef(false), foreground = useRef(AppState.currentState === 'active');
  const [active, setActive] = useState(false), { text } = useQolipText(), notice = useQolipNotice();
  const current = useCallback(() => focus.current && foreground.current && original.role.current(), [original]);
  const valid = original.session === session && original.boundary === boundary && original.mode === mode && original.role.current();
  const camera = useQolipQrCamera(active && valid, current), cameraMethods = useRef(camera), callbacks = useRef({ onClose, onResult, text, notice });
  useLayoutEffect(() => { cameraMethods.current = camera; callbacks.current = { onClose, onResult, text, notice }; });
  // The constructor only stores these event callbacks; none reads a ref during construction.
  // eslint-disable-next-line react-hooks/refs
  const [controller] = useState(() => new QolipQrScannerState(mode, {
    current, stop: () => cameraMethods.current.stop(), restart: () => cameraMethods.current.restart(),
    cameraFailed: () => cameraMethods.current.cameraFailed(),
    lookup: (qr, guard) => qolipCellQrLookup(original.session, qr, guard),
    complete: result => callbacks.current.onResult(result),
    notify: key => callbacks.current.notice.show(callbacks.current.text(key)),
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const retire = useCallback(() => { controller.suspend(); void cameraMethods.current.stop(); }, [controller]);
  useFocusEffect(useCallback(() => {
    focus.current = true; setActive(current());
    return () => { focus.current = false; setActive(false); retire(); };
  }, [current, retire]));
  useEffect(() => {
    const stopBoundary = original.role.subscribe(() => { if (!original.role.current()) { setActive(false); retire(); } });
    const listener = AppState.addEventListener('change', value => {
      foreground.current = value === 'active';
      if (!foreground.current) { setActive(false); retire(); } else if (focus.current && original.role.current()) setActive(true);
    });
    if (!original.role.current()) retire();
    return () => { stopBoundary(); listener.remove(); };
  }, [original, retire]);
  useEffect(() => {
    if (!active) return;
    controller.activate(); void controller.retry();
    return () => { controller.suspend(); void cameraMethods.current.stop(); };
  }, [active, controller]);
  useLayoutEffect(() => { if (!valid) { controller.invalidate(); void cameraMethods.current.stop(); } }, [valid, controller]);
  const close = () => {
    if (!current() || !controller.canAct()) return false;
    setActive(false); retire(); callbacks.current.onClose();
    return true;
  };
  return { state, camera, valid: valid && !state.invalid, active: active && valid && !state.invalid, notice: notice.message, text,
    title: text(`scanner.title.${qolipScannerModeKey(mode)}`), status: text(state.status), close,
    retry: () => { void controller.retry(); },
    detect: (rawValue: string | undefined, displayValue: string, generation: number) => {
      void controller.detect([{ rawValue: rawValue ?? displayValue, displayValue }], generation);
    } };
}
