import { Button, Host, HStack, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { fixedSize, font, foregroundStyle, listStyle, multilineTextAlignment, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { PlatformColor, View } from 'react-native';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { RezkaPaddonReadOnlyProps } from './rezkaPaddonListModel';
import { useRezkaPaddonList } from './useRezkaPaddonList';

/** Read-only content for a future reviewed host; no Paddon navigation or mutation is connected. */
export function RezkaPaddonReadOnly({ snapshot, apparatusId = '', apparatusName = '', navigation }: RezkaPaddonReadOnlyProps) {
  const { state, content, controller, isCurrent } = useRezkaPaddonList(snapshot, apparatusId, apparatusName);
  if (!isCurrent() || state.phase === 'invalid' || state.phase === 'unavailable') return null;
  return <View style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <Stack.Screen options={{ title: content.title, headerTitle: () => <Host matchContents><VStack spacing={2}>
      <Text modifiers={[font({ textStyle: 'headline' })]}>{content.title}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{content.subtitle}</Text></VStack></Host>,
      ...(navigation ? { headerLeft: () => <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} /> } : {}) }} />
    {state.phase === 'loading' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Host matchContents><ProgressView /></Host></View>
      : state.phase === 'error' ? <View style={{ flex: 1, alignItems: 'center', padding: 24 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <VStack spacing={16}><Text modifiers={[multilineTextAlignment('center')]}>{content.loadFailed}</Text>
          <Button label={content.retry} onPress={() => { void controller.refresh(); }} /></VStack>
      </Host></View> : <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), refreshable(() => controller.refresh())]}>
        {state.scope.needsApparatus ? <Section>{content.options.map((item, index) => <Text key={`${item.id}:${index}`}>{item.title}</Text>)}</Section>
          : <>
            <Section><VStack alignment="leading" spacing={8}>
              <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{content.summaryTitle}</Text>
              <Text modifiers={[fixedSize({ horizontal: false, vertical: true })]}>{content.summarySubtitle}</Text>
              <HStack spacing={12}><Text>{content.paddonMetric}</Text><Text>{content.wipMetric}</Text></HStack>
            </VStack></Section>
            <Section title={content.title}>{content.rows.length ? content.rows.map((row, index) => <VStack key={`${row.code}:${index}`} alignment="leading" spacing={4}>
              <HStack spacing={12}><Text modifiers={[font({ textStyle: 'headline' })]}>{row.code}</Text><Text>{row.count}</Text></HStack>
              {row.subtitle ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.subtitle}</Text> : null}
            </VStack>) : <VStack spacing={4}><Text>{content.emptyTitle}</Text>
              <Text modifiers={[fixedSize({ horizontal: false, vertical: true }), multilineTextAlignment('center')]}>{content.emptyBody}</Text></VStack>}
            </Section>
          </>}
      </List></Host>}
  </View>;
}
