import { Redirect, router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { RezkaSessionWaiting } from './RezkaSessionWaiting';
import { RezkaSplitScreen } from './RezkaSplit';
import { RezkaSplitScanner } from './RezkaSplitScanner';
import { RezkaTestSessionUnavailable } from './RezkaTestSessionUnavailable';
import { isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { useRezkaScanner } from './useRezkaScanner';
import { useRezkaShellSession } from './useRezkaShell';

/** The split feature has its own V2 capability/role guard, independent of the master drawer. */
export default function RezkaSplitRoute() {
  const snapshot = useRezkaShellSession('split');
  if (snapshot === null) return <Redirect href="/" />;
  if (snapshot === 'test-token-unavailable') return <RezkaTestSessionUnavailable />;
  if (snapshot === 'transition-pending') return <RezkaSessionWaiting />;
  if (snapshot === undefined) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!isRezkaSessionCurrent(snapshot, 'split')) return <Redirect href="/" />;
  return <SplitReady snapshot={snapshot} />;
}
function SplitReady({ snapshot }: { snapshot: RezkaSessionSnapshot }) {
  const scanner = useRezkaScanner(snapshot), { ticket, generation } = scanner.state;
  const onBack = router.canGoBack() ? () => { if (isRezkaSessionCurrent(snapshot, 'split')) router.back(); } : undefined;
  // No real bridge has yet been reviewed for this screen. Read/form remain usable; no mutation is exposed.
  return <><RezkaSplitScreen snapshot={snapshot} printer={null} onBack={onBack} scan={scanner} />
    {ticket !== null ? <RezkaSplitScanner key={ticket} active={scanner.state.active} generation={generation} isCurrent={() => scanner.accepts(ticket, generation)}
      close={() => scanner.cancel(ticket)} accept={value => scanner.accept(ticket, value, generation)} /> : null}</>;
}
