import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { Button, Divider, Image, List, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, font, foregroundStyle, frame, labelStyle, listRowBackground, listRowInsets, listRowSeparator, listStyle, padding, refreshable, scrollContentBackground } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkerProfileScreenProps } from './AdminWorkerProfileScreenTypes';
import type { AdminWorkerProfileCard } from './adminWorkerProfilePresentation';
import { useAdminWorkerProfile } from './useAdminWorkerProfile';

/** @v2 _InfoCard and _InfoLine */
export function WorkerProfileInfoCard({ card }: { card: AdminWorkerProfileCard }) {
  const { colors } = useBaseTheme(); return <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 16 }), background(colors.surface), cornerRadius(16), listRowBackground('clear'), listRowSeparator('hidden'), listRowInsets({ leading: 8, trailing: 8, top: 0, bottom: 8 })]}>
    <Text modifiers={[font({ textStyle: 'title3', weight: 'heavy' })]}>{card.title}</Text><Spacer modifiers={[frame({ height: 12 })]} />
    {card.rows.map((row, index) => <VStack key={index} alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      {index ? <Divider modifiers={[padding({ vertical: 8.5 })]} /> : null}<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.label}</Text><Spacer modifiers={[frame({ height: 4 })]} /><Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' })]}>{row.value}</Text>
    </VStack>)}
  </VStack>;
}
/** @v2 AdminWorkerProfileDetailScreen */
export function AdminWorkerProfileScreen(props: AdminWorkerProfileScreenProps) {
  const model = useAdminWorkerProfile(props), { colors } = useBaseTheme(); if (!model.current() || !model.state.valid) return null;
  return <><Stack.Screen options={{ headerShown: true, title: model.title, headerBackVisible: false, headerRight: () => props.profileAction,
    headerLeft: () => <BaseHost matchContents><Button onPress={model.back} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(props.backLabel)]}><Image systemName="chevron.left" size={20} /></Button></BaseHost> }} />
    <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}><AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-worker-profile-body-frame"><BaseHost style={styles.screen}>
      {model.state.phase === 'content' ? <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), padding({ top: 8 }), refreshable(model.reload)]}>
        {model.cards.map((card, index) => <WorkerProfileInfoCard key={index} card={card} />)}<Spacer modifiers={[frame({ height: 116 }), listRowBackground('clear'), listRowSeparator('hidden'), listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 })]} />
      </List> : <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        {model.state.phase === 'loading' ? <ProgressView /> : <Button label={model.retryLabel} onPress={() => { void model.reload(); }} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 56 }), accessibilityIdentifier('admin-worker-profile-retry')]} />}
      </VStack>}
    </BaseHost></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View></View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
