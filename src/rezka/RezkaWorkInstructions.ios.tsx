import { Host, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { fixedSize, font, foregroundStyle, listStyle, multilineTextAlignment } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { PlatformColor, View } from 'react-native';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { RezkaInstructionSection, RezkaInstructionsScreenProps } from './rezkaWorkInstructionsModel';
import { useRezkaWorkInstructions } from './useRezkaWorkInstructions';

function InstructionsSection({ section }: { section: RezkaInstructionSection }) {
  return <VStack alignment="leading" spacing={8}>
    <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{section.title}</Text>
    {section.items.map((item, index) => <Text key={index} modifiers={[fixedSize({ horizontal: false, vertical: true })]}>{item}</Text>)}
  </VStack>;
}

// @v2 AparatchiWorkInstructionsScreen
export function RezkaWorkInstructionsScreen({ snapshot, navigation }: RezkaInstructionsScreenProps) {
  const { state, content, isCurrent } = useRezkaWorkInstructions(snapshot);
  if (!isCurrent() || state.phase === 'invalid') return null;
  return <View style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <Stack.Screen options={{ title: content.title, headerTitle: () => <Host matchContents><VStack spacing={2}>
      <Text modifiers={[font({ textStyle: 'headline' })]}>{content.title}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{content.subtitle}</Text></VStack></Host>,
      ...(navigation ? { headerLeft: () => <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} /> } : {}) }} />
    {state.phase === 'loading' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Host matchContents><ProgressView /></Host></View>
      : !content.guides.length ? <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <VStack spacing={6}><Text modifiers={[font({ textStyle: 'headline' }), multilineTextAlignment('center')]}>{content.emptyTitle}</Text>
          <Text modifiers={[multilineTextAlignment('center')]}>{content.emptyBody}</Text></VStack>
      </Host></View> : <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped')]}>
        <Section><Text modifiers={[fixedSize({ horizontal: false, vertical: true })]}>{content.intro}</Text></Section>
        {content.common.map((section, index) => <Section key={index}><InstructionsSection section={section} /></Section>)}
        {content.guides.map((guide, index) => <Section key={`${guide.id}:${index}`}>
          <VStack alignment="leading" spacing={16}>
            <VStack alignment="leading" spacing={3}><Text modifiers={[font({ textStyle: 'headline' })]}>{guide.name}</Text>
              <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{guide.kind}</Text></VStack>
            {guide.sections.map((section, index) => <InstructionsSection key={index} section={section} />)}
          </VStack>
        </Section>)}
      </List></Host>}
  </View>;
}
