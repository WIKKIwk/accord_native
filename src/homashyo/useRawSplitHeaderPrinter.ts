import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { rawSplitSessionIsCurrent } from './rawSplitApi';
import { useRawSplitContext } from './RawSplitContext';

/** Ignore picker failures from an old focus or session instead of alerting over a different screen/account. */
export function useRawSplitHeaderPrinter(controller: { selectPrinter(): Promise<unknown> }): () => void {
  const { ticket } = useRawSplitContext(), owner = useRef({ focused: false, generation: 0 });
  useFocusEffect(useCallback(() => {
    owner.current.focused = true; owner.current.generation++;
    return () => { owner.current.focused = false; owner.current.generation++; };
  }, []));
  return () => {
    const generation = owner.current.generation;
    const current = () => owner.current.focused && owner.current.generation === generation && rawSplitSessionIsCurrent(ticket);
    if (!current()) return;
    const report = (error: unknown) => { if (current()) Alert.alert('Xatolik', String(error)); };
    try { void controller.selectPrinter().catch(report); } catch (error) { report(error); }
  };
}
