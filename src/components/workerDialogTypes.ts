import type { ComponentRef, ReactNode, RefObject } from 'react';
import type { ScrollView } from 'react-native';

export type WorkerAlertData = { title: string; message: string; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void };
export type WorkerAlertProps = { alert: WorkerAlertData | null; onDismiss: () => void; onCancel?: () => void };

export type WorkerFormDialogProps = {
  visible: boolean; title: string; children: ReactNode;
  confirmLabel: string; onConfirm: () => void; confirmDisabled?: boolean;
  cancelLabel?: string; onCancel: () => void; cancelDisabled?: boolean; preventDismiss?: boolean; onDismiss?: () => void; onShow?: () => void;
  dismissOnBackdrop?: boolean;
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
};

export type WorkerRadioChoiceProps = { label: string; selected: boolean; disabled?: boolean; onPress: () => void };
export type WorkerIconButtonProps = { icon: 'close' | 'edit' | 'check' | 'back' | 'photo' | 'scannedWips'; label: string; onPress: () => void; tonal?: boolean };
export type WorkerDeliveryDialogProps = {
  visible: boolean; name: string; barcode: string; choices: { key: string; label: string }[]; selected: string; error: string;
  busy: boolean; canConfirm: boolean; onChoose: (key: string) => void; onCancel: () => void; onConfirm: () => void;
};
