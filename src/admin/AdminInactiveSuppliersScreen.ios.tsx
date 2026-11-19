import { Button, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame,
  padding, textSelection } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import type { AdminInactiveSupplier } from './adminInactiveSuppliersApi';
import type { AdminInactiveSuppliersScreenProps } from './AdminInactiveSuppliersTypes';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { useAdminInactiveSuppliers } from './useAdminInactiveSuppliers';

type Model = ReturnType<typeof useAdminInactiveSuppliers>;
function SupplierCard({ item, model, index }: { item: AdminInactiveSupplier; model: Model; index: number }) {
  const { colors } = useBaseTheme(), busy = model.state.busyRef === item.ref;
  return <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 18 }), background(colors.surface), cornerRadius(24)]}>
    <HStack><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{item.name}</Text>
      {item.removed || item.blocked ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), padding({ horizontal: 10, vertical: 6 }),
        background(colors.surfaceContainerHigh), cornerRadius(999)]}>{model.a(item.removed ? 'users.removed' : 'users.blocked')}</Text> : null}
    </HStack><Spacer modifiers={[frame({ height: 6 })]} />
    <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{item.phone}</Text><Spacer modifiers={[frame({ height: 10 })]} />
    <Text modifiers={[font({ textStyle: 'headline' }), textSelection(true)]}>{item.code}</Text><Spacer modifiers={[frame({ height: 12 })]} />
    <HStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      {item.removed ? <Button onPress={() => model.restore(item)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(busy), frame({ maxWidth: Infinity, minHeight: 56 }),
        accessibilityIdentifier(`admin-inactive-supplier-restore-${index}`)]}>
        <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a(busy ? 'users.restoring' : 'users.restore')}</Text>
      </Button> : null}
      {item.removed && item.blocked ? <Spacer modifiers={[frame({ width: 12 })]} /> : null}
      {item.blocked && !item.removed ? <Button onPress={() => model.unblock(item)} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(busy), frame({ maxWidth: Infinity, minHeight: 56 }),
        accessibilityIdentifier(`admin-inactive-supplier-unblock-${index}`)]}>
        <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a(busy ? 'users.unblocking' : 'users.unblock')}</Text>
      </Button> : null}
    </HStack>
  </VStack>;
}

function SupplierList({ model }: { model: Model }) {
  const items = model.state.items, owner = useMemo(() => ({ items }), [items]), mounted = useRef<typeof owner | null>(null);
  type Metrics = { owner: typeof owner; viewport: number | null; content: number | null };
  const latest = useRef<Metrics | null>(null), [metrics, setMetrics] = useState<Metrics | null>(null);
  useLayoutEffect(() => { mounted.current = owner; return () => { if (mounted.current === owner) mounted.current = null; }; }, [owner]);
  const record = (key: 'viewport' | 'content', value: number) => {
    if (mounted.current !== owner || !Number.isFinite(value) || value < 0 || key === 'viewport' && value === 0) return;
    const previous = latest.current?.owner === owner ? latest.current : { owner, viewport: null, content: null };
    if (previous[key] === value) return;
    const next = { ...previous, [key]: value }; latest.current = next; setMetrics(next);
  };
  const canRefresh = (value: Metrics | null) => value?.owner === owner && value.viewport !== null && value.content !== null && value.content - value.viewport > .5;
  const refresh = () => mounted.current === owner && canRefresh(latest.current) ? model.reload() : Promise.resolve();
  // The native UIScrollView reports actual geometry on every supported iOS version.
  return <FlatList style={styles.content} data={items} keyExtractor={(item, index) => `${item.ref}:${index}`}
    contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.list}
    renderItem={({ item, index }) => <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><SupplierCard item={item} model={model} index={index} /></BaseHost>}
    ItemSeparatorComponent={() => <View style={styles.separator} />} onLayout={event => record('viewport', event.nativeEvent.layout.height)}
    onContentSizeChange={(_width, height) => record('content', height)}
    refreshControl={canRefresh(metrics) ? <RefreshControl refreshing={false} onRefresh={refresh} /> : undefined} />;
}

/** @v2 AdminInactiveSuppliersScreen */
export function AdminInactiveSuppliersScreen(props: AdminInactiveSuppliersScreenProps) {
  const model = useAdminInactiveSuppliers(props), { state } = model, { colors, chromeBackground } = useAdminShellTheme();
  if (!model.current || state.phase === 'invalidated') return null;
  return <><Stack.Screen options={{ headerShown: true, title: model.a('users.inactive_title'), headerBackVisible: false,
    headerRight: props.profileAction ? () => props.profileAction : undefined,
    headerLeft: () => <BaseHost matchContents><Button onPress={props.navigation.onPress} modifiers={[buttonStyle('plain'), accessibilityLabel(props.navigation.label), frame({ minWidth: 44, minHeight: 44 })]}>
      <Image systemName={props.navigation.icon === 'back' ? 'chevron.left' : 'line.3.horizontal'} size={20} />
    </Button></BaseHost> }} />
    <View style={[styles.screen, { backgroundColor: chromeBackground }]}>
      {props.topNotice}<AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-inactive-suppliers-body-frame" contentPadding="default">
        {state.phase === 'loading' ? <BaseHost style={styles.content}><VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack></BaseHost> :
          state.phase === 'error' ? <BaseHost style={styles.content}><VStack spacing={16} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
            <Text>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={model.reload}
              modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 44 }), accessibilityIdentifier('admin-inactive-suppliers-retry')]} />
          </VStack></BaseHost> : state.items.length === 0 ? <BaseHost style={styles.content}><VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
            <Text modifiers={[font({ textStyle: 'headline' }), padding({ all: 18 }), background(colors.surface), cornerRadius(24)]}>{model.a('users.inactive_empty')}</Text>
          </VStack></BaseHost> : <SupplierList model={model} />}
      </AdminShellBodyFrame>
      <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    </View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, fullWidth: { width: '100%' }, list: { paddingTop: 4 }, separator: { height: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
