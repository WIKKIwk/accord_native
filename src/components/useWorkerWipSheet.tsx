import { useNativeSheet } from '../nativeSheet';

export function useWorkerWipSheet() {
  const sheet = useNativeSheet();
  return { sheet, dialogs: null };
}
