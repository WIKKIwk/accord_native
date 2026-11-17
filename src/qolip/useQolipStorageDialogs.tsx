import { useEffect, useRef, useState } from 'react';
import { extensionText } from '../shared/localization';
import { QolipPaddonCreateDialog } from './QolipPaddonCreateDialog';
import { QolipInspectionDialog } from './QolipInspectionDialog';
import { QolipRawMaterialScanner } from './QolipRawMaterialScanner';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
import type { QolipPaddonCreateDraft } from './qolipStorageFormsState';
import { QolipStorageConfirm, QolipStorageExpiredDialog } from './QolipStorageConfirm';
import type { StorageConfirmation } from './qolipStorageViewProps';

export function useQolipStorageDialogs() {
  const role = useQolipRole(), { locale, text: qolipText } = useQolipText();
  const { boundary, isCurrent } = role;
  const text = (key: string) => extensionText('qolipStorageText', key, locale);
  const [create, setCreate] = useState<{ warehouses: readonly string[]; draft: QolipPaddonCreateDraft | null; resolve(value: QolipPaddonCreateDraft | null): void } | null>(null);
  const [inspection, setInspection] = useState<{ expected: readonly string[]; resolve(value: readonly string[] | null): void } | null>(null);
  const [scan, setScan] = useState<{ title: string; resolve(value: string | null): void } | null>(null);
  const [confirmation, setConfirmation] = useState<StorageConfirmation | null>(null);
  const [expired, setExpired] = useState<{ barrierDismissible: boolean } | null>(null);
  const pending = useRef(new Set<() => void>()), confirmationActive = useRef(false), inspectionActive = useRef(false);
  useEffect(() => {
    const callbacks = pending.current;
    const stop = boundary.subscribe(() => {
      if (!isCurrent()) {
        if (callbacks.size) setExpired({ barrierDismissible: !inspectionActive.current });
        for (const settle of callbacks) settle();
      }
    });
    return () => { stop(); for (const settle of callbacks) settle(); callbacks.clear(); };
  }, [boundary, isCurrent]);
  const confirm = (title: string, message: string, destructive = false): Promise<boolean> => {
    if (confirmationActive.current) return Promise.resolve(false);
    confirmationActive.current = true;
    return new Promise(resolve => {
    let settled = false;
    const finish = (value: boolean) => { if (!settled) { settled = true; confirmationActive.current = false; pending.current.delete(cancel); setConfirmation(null); resolve(value && role.isCurrent()); } };
    const cancel = () => finish(false); pending.current.add(cancel);
    setConfirmation({ title, message, cancel: text('cancel'), confirm: destructive ? qolipText('action.delete') : text('confirm'), destructive, resolve: finish });
    });
  };
  const scanRaw = (title = text('scan')): Promise<string | null> => new Promise(resolve => {
    let settled = false;
    const finish = (value: string | null) => { if (settled) return; settled = true; pending.current.delete(cancel); setScan(null); resolve(role.isCurrent() ? value : null); };
    const cancel = () => finish(null); pending.current.add(cancel); setScan({ title, resolve: finish });
  });
  return { text, confirm, scanRaw,
    createDialog: (warehouses: readonly string[], draft: QolipPaddonCreateDraft | null): Promise<QolipPaddonCreateDraft | null> => new Promise(resolve => {
      let settled = false;
      const finish = (value: QolipPaddonCreateDraft | null) => { if (settled) return; settled = true; pending.current.delete(cancel); setCreate(null); resolve(role.isCurrent() ? value : null); };
      const cancel = () => finish(null); pending.current.add(cancel); setCreate({ warehouses, draft, resolve: finish });
    }),
    inspect: (expected: readonly string[]): Promise<readonly string[] | null> => new Promise(resolve => {
      inspectionActive.current = true;
      let settled = false;
      const finish = (value: readonly string[] | null) => { if (settled) return; settled = true; inspectionActive.current = false; pending.current.delete(cancel); setInspection(null); resolve(role.isCurrent() ? value : null); };
      const cancel = () => finish(null); pending.current.add(cancel); setInspection({ expected, resolve: finish });
    }),
    overlays: <>
      {expired && <QolipStorageExpiredDialog message={text('session_changed')} close={() => setExpired(null)} barrierDismissible={expired.barrierDismissible} />}
      {confirmation && <QolipStorageConfirm value={confirmation} />}
      {create && <QolipPaddonCreateDialog boundary={role.boundary} warehouses={create.warehouses} initial={create.draft} close={create.resolve} />}
      {inspection && <QolipInspectionDialog boundary={role.boundary} expected={inspection.expected} scan={() => scanRaw()} close={inspection.resolve} barrierDismissible={false} />}
      {scan && <QolipRawMaterialScanner visible title={scan.title} manualLabel={scan.title} onComplete={scan.resolve} />}
    </>,
  };
}
