import type { ReactNode } from 'react';
export type WorkerPaddonChoice = { id: string; title: string; subtitle?: string; destructive?: boolean };
export type WorkerPaddonDialogData = { title: string; message?: string; choices?: WorkerPaddonChoice[];
  confirmLabel?: string; cancelLabel?: string; confirmDisabled?: boolean; destructive?: boolean; kind?: 'review' };
export type WorkerPaddonDialogProps = { data: WorkerPaddonDialogData | null; visible: boolean; children?: ReactNode;
  close(value: string | null): void; dismissed(): void };
export type WorkerPaddonPickerProps = { choices: WorkerPaddonChoice[]; choose(id: string): void; compact?: boolean };
