import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useAdminShell } from '../admin/AdminShellContext';
import { WorkerInventoryContent } from '../components/WorkerInventoryScreen.ios';
import { CustomerSnackbar } from '../customer/CustomerSnackbar.ios';
import { useBrigaderInventorySurface } from './useBrigaderInventorySurface';

export function BrigaderInventoryRoute() {
  const shell = useAdminShell(), surface = useBrigaderInventorySurface();
  const [feedback, setFeedback] = useState<{ message: string; id: number } | null>(null), sequence = useRef(0);
  const { owner, state, t } = surface;
  useEffect(() => {
    if (!state.notice || !owner.current()) return;
    setFeedback({ message: t(state.notice), id: ++sequence.current });
    owner.clearNotice();
  }, [state.notice, owner, t]);
  const dismissFeedback = useCallback(() => { if (owner.current()) setFeedback(null); }, [owner]);
  const goBack = useCallback(() => {
    if (!shell.isCurrent()) return;
    if (router.canGoBack()) router.back();
    else router.replace('/ios-brigader' as Href);
  }, [shell]);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  return <View style={{ flex: 1 }}>
    <WorkerInventoryContent session={shell.session} onBack={goBack} surface={surface} sourceMode />
    <CustomerSnackbar message={feedback?.message ?? ''} messageId={feedback?.id ?? null} onDismiss={dismissFeedback} />
  </View>;
}
