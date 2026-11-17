import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
// @v2 _QolipAttachSheet
export function QolipCatalogSpecSheet({ children, standalone, saving, close }: { children: ReactNode; standalone: boolean; saving: boolean; close(): void }) {
  return <WorkerOrderSheet dismissible preventDismiss={standalone && saving} onClose={close} heightFraction={0.92}><ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView></WorkerOrderSheet>;
}
