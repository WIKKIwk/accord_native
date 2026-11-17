import { Button, HStack, Image, Picker, ProgressView, ScrollView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, labelStyle, lineLimit, padding, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import type { AdminQueuePolicyScreenProps } from './AdminQueuePolicyTypes';
import { useAdminQueuePolicy } from './useAdminQueuePolicy';

/** @v2 AdminQueuePolicyScreen */
export function AdminQueuePolicyScreen(props: AdminQueuePolicyScreenProps) {
  const model = useAdminQueuePolicy(props), { colors } = useBaseTheme(), insets = useSafeAreaInsets();
  if (!model.current || model.state.invalidated) return <View style={styles.root} />;
  return <><Stack.Screen options={{ headerShown: true, title: model.a('queue.title'), headerBackVisible: false,
    headerRight: props.profileAction ? () => props.profileAction : undefined,
    headerLeft: () => <BaseHost matchContents><Button onPress={model.navigation.onPress} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.navigation.label)]}><Image systemName={model.navigation.icon === 'back' ? 'chevron.left' : 'line.3.horizontal'} size={20} /></Button></BaseHost> }} />
    <View style={[styles.root, { backgroundColor: colors.surfaceContainerHigh }]}>{props.topNotice}<AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-queue-policy-body-frame"><BaseHost style={styles.root}>
      {model.state.loading && !model.state.data ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack> :
        model.state.loadError != null && !model.state.data ? <VStack spacing={16} modifiers={[padding({ horizontal: 24, top: 40 }), frame({ maxWidth: Infinity })]}>
          <Text>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={model.reload} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 54 }), accessibilityIdentifier('admin-queue-policy-retry')]} />
        </VStack> : model.state.data ? <ScrollView><VStack spacing={0} modifiers={[padding({ top: 4, leading: 4, trailing: 4, bottom: insets.bottom + 128 }), frame({ maxWidth: Infinity })]}>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), padding({ horizontal: 4 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a('queue.intro')}</Text>
          <Spacer modifiers={[frame({ height: model.rows.length ? 10 : 24 })]} />
          {!model.rows.length ? <Text>{model.a('queue.empty')}</Text> : model.rows.map(row => <VStack key={row.apparatus.id} alignment="leading" spacing={12}
            modifiers={[padding({ leading: 14, trailing: 14, top: 12, bottom: 12 }), background(row.policy.locked ? colors.surfaceContainerHighest : colors.surface), cornerRadius(14), padding({ bottom: 2 }), frame({ maxWidth: Infinity })]}>
            <HStack spacing={14}><Image systemName="gearshape.2" size={18} /><VStack alignment="leading" spacing={2}>
              <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(2)]}>{row.title}</Text>
              {row.policy.locked ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{model.a('queue.locked_hint')}</Text> : null}
            </VStack><Spacer />{row.policy.locked ? <Image systemName="lock" size={18} /> : row.saving ? <ProgressView /> : null}</HStack>
            <Picker label="" selection={row.policy.policy} onSelectionChange={value => { if (value === 'strict_sequence' || value === 'free_pick') row.change(value); }}
              modifiers={[pickerStyle('segmented'), disabled(!row.enabled), frame({ minHeight: 44 }), accessibilityIdentifier(`admin-queue-policy-${row.apparatus.id}`)]}>
              <Text modifiers={[tag('strict_sequence')]}>{model.a('queue.strict')}</Text><Text modifiers={[tag('free_pick')]}>{model.a('queue.free')}</Text>
            </Picker>
          </VStack>)}
        </VStack></ScrollView> : null}
    </BaseHost></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View></View>
  </>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
