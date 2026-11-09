import { Column, Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import type { RezkaInstructionSection, RezkaInstructionsScreenProps } from './rezkaWorkInstructionsModel';
import { useRezkaWorkInstructions } from './useRezkaWorkInstructions';

function InstructionsSection({ section }: { section: RezkaInstructionSection }) {
  return <Column verticalArrangement={{ spacedBy: 8 }}>
    <Text style={{ typography: 'titleSmall' }}>{section.title}</Text>
    {section.items.map((item, index) => <Text key={index} style={{ typography: 'bodyMedium' }}>{item}</Text>)}
  </Column>;
}

// @v2 AparatchiWorkInstructionsScreen
export function RezkaWorkInstructionsScreen({ snapshot, navigation }: RezkaInstructionsScreenProps) {
  const { state, content, isCurrent } = useRezkaWorkInstructions(snapshot), colors = useMaterialColors(), insets = useSafeAreaInsets();
  if (!isCurrent() || state.phase === 'invalid') return null;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ headerShown: false }} /><RoleHeader title={content.title} subtitle={content.subtitle} navigation={navigation ?? undefined} />
    {state.phase === 'loading' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>
      : !content.guides.length ? <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 6 }}><Text style={{ typography: 'titleMedium', textAlign: 'center' }}>{content.emptyTitle}</Text>
          <Text style={{ typography: 'bodyMedium', textAlign: 'center' }}>{content.emptyBody}</Text></Column>
      </Host></View> : <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 120, gap: 12 }}>
        <WorkerQueueCard first last backgroundColor={colors.primaryContainer}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <Text color={colors.onPrimaryContainer} style={{ typography: 'bodyMedium' }}>{content.intro}</Text></Host></WorkerQueueCard>
        {content.common.map((section, index) => <WorkerQueueCard key={index} first last backgroundColor={colors.surfaceContainerLowest}>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><InstructionsSection section={section} /></Host>
        </WorkerQueueCard>)}
        {content.guides.map((guide, index) => <WorkerQueueCard key={`${guide.id}:${index}`} first last backgroundColor={colors.surfaceContainerLowest}>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 16 }}>
            <Column verticalArrangement={{ spacedBy: 3 }}><Text style={{ typography: 'titleMedium' }}>{guide.name}</Text>
              <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{guide.kind}</Text></Column>
            {guide.sections.map((section, index) => <InstructionsSection key={index} section={section} />)}
          </Column></Host>
        </WorkerQueueCard>)}
      </ScrollView>}
  </SafeAreaView>;
}
