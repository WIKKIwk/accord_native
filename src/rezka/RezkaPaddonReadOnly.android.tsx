import { Button, Column, Host, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { Stack } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import type { RezkaPaddonReadOnlyProps } from './rezkaPaddonListModel';
import { useRezkaPaddonList } from './useRezkaPaddonList';

/** Read-only content for a future reviewed host; no Paddon navigation or mutation is connected. */
export function RezkaPaddonReadOnly({ snapshot, apparatusId = '', apparatusName = '', navigation }: RezkaPaddonReadOnlyProps) {
  const { state, content, controller, isCurrent } = useRezkaPaddonList(snapshot, apparatusId, apparatusName);
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  if (!isCurrent() || state.phase === 'invalid' || state.phase === 'unavailable') return null;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ headerShown: false }} /><RoleHeader title={content.title} subtitle={content.subtitle} navigation={navigation ?? undefined} />
    {state.phase === 'loading' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>
      : state.phase === 'error' ? <View style={{ alignItems: 'center', padding: 24 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }}><Text style={{ typography: 'bodyLarge', textAlign: 'center' }}>{content.loadFailed}</Text>
          <Button onClick={() => { void controller.refresh(); }}><Text>{content.retry}</Text></Button></Column>
      </Host></View> : <ScrollView contentContainerStyle={state.scope.needsApparatus ? { padding: 12, gap: 8 } : { padding: 4, paddingBottom: insets.bottom + 120, gap: 8 }}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => { void controller.refresh(); }} />}>
        {state.scope.needsApparatus ? content.options.map((item, index) => <WorkerQueueCard key={`${item.id}:${index}`} first last backgroundColor={colors.surfaceContainerLowest}>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text>{item.title}</Text></Host></WorkerQueueCard>) : <>
          <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
            <Column verticalArrangement={{ spacedBy: 8 }}><Text style={{ typography: 'titleLarge' }}>{content.summaryTitle}</Text>
              <Text style={{ typography: 'bodyMedium' }}>{content.summarySubtitle}</Text>
              <Row horizontalArrangement={{ spacedBy: 8 }}><Text>{content.paddonMetric}</Text><Text>{content.wipMetric}</Text></Row></Column>
          </Host></WorkerQueueCard>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text style={{ typography: 'titleMedium' }}>{content.title}</Text></Host>
          {content.rows.length ? content.rows.map((row, index) => <WorkerQueueCard key={`${row.code}:${index}`} first last backgroundColor={colors.surfaceContainerLowest}>
            <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 4 }}>
              <Row horizontalArrangement={{ spacedBy: 12 }}><Text style={{ typography: 'titleMedium' }}>{row.code}</Text><Text>{row.count}</Text></Row>
              {row.subtitle ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{row.subtitle}</Text> : null}
            </Column></Host></WorkerQueueCard>) : <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}>
            <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 4 }}>
              <Text>{content.emptyTitle}</Text><Text style={{ typography: 'bodyMedium', textAlign: 'center' }}>{content.emptyBody}</Text>
            </Column></Host></WorkerQueueCard>}
        </>}
      </ScrollView>}
  </SafeAreaView>;
}
