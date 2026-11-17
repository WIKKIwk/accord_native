import { Button, Column, IconButton, OutlinedButton, RNHostView, Row, Shape, Spacer, Surface, TextButton, TopAppBar } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text as NativeText, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminText as Text, useAdminFontsReady } from './AdminTypography.android';
import { adminFontNames } from './adminFontFamily.android';
import type { AdminInactiveSupplier } from './adminInactiveSuppliersApi';
import type { AdminInactiveSuppliersScreenProps } from './AdminInactiveSuppliersTypes';
import { useAdminInactiveSuppliers } from './useAdminInactiveSuppliers';

type Model = ReturnType<typeof useAdminInactiveSuppliers>;
const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
function SoftCard({ children }: { children: ReactNode }) {
  const { colors, mode } = useBaseTheme(), dark = mode === 'dark';
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: dark ? 1.35 : 1,
    boxShadow: [{ offsetX: 0, offsetY: dark ? 8 : 2, blurRadius: dark ? 18 : 8, color: dark ? '#00000018' : '#00000006' }] }]}>
    {children}
  </View>;
}
function SupplierCard({ item, model, index }: { item: AdminInactiveSupplier; model: Model; index: number }) {
  const { colors, direction } = useBaseTheme(), fontsReady = useAdminFontsReady(), busy = model.state.busyRef === item.ref;
  return <SoftCard><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <Text style={{ typography: 'titleLarge' }} modifiers={[weight(1)]}>{item.name}</Text>
      {item.removed || item.blocked ? <Surface color="transparent" shape={rounded(999)} border={{ width: 1, color: colors.outlineVariant }}>
        <Text color="#FFFFFF" style={{ typography: 'bodySmall' }} modifiers={[padding(10, 6, 10, 6)]}>{model.a(item.removed ? 'users.removed' : 'users.blocked')}</Text>
      </Surface> : null}
    </Row><Spacer modifiers={[height(6)]} />
    <Text style={{ typography: 'bodySmall' }}>{item.phone}</Text><Spacer modifiers={[height(10)]} />
    <RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth()]}><NativeText selectable style={[styles.code, { color: colors.onSurface, fontFamily: fontsReady ? adminFontNames.medium : undefined,
      writingDirection: direction === 'rightToLeft' ? 'rtl' : 'ltr', textAlign: direction === 'rightToLeft' ? 'right' : 'left' }]}>{item.code}</NativeText></RNHostView>
    <Spacer modifiers={[height(12)]} /><Row modifiers={[fillMaxWidth()]}>
      {item.removed ? <Button onClick={() => model.restore(item)} enabled={!busy} shape={rounded(20)}
        modifiers={[weight(1), height(56), testID(`admin-inactive-supplier-restore-${index}`)]}>
        <Text style={{ typography: 'labelLarge' }}>{model.a(busy ? 'users.restoring' : 'users.restore')}</Text>
      </Button> : null}
      {item.removed && item.blocked ? <Spacer modifiers={[size(12, 1)]} /> : null}
      {item.blocked && !item.removed ? <OutlinedButton onClick={() => model.unblock(item)} enabled={!busy} shape={rounded(20)}
        colors={{ contentColor: colors.onSurface }}
        modifiers={[weight(1), height(56), testID(`admin-inactive-supplier-unblock-${index}`)]}>
        <Text style={{ typography: 'labelLarge' }}>{model.a(busy ? 'users.unblocking' : 'users.unblock')}</Text>
      </OutlinedButton> : null}
    </Row>
  </Column></BaseHost></SoftCard>;
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
  // AppRefreshIndicator's default rejects lists whose native scroll extent is <= .5.
  const canRefresh = (value: Metrics | null) => value?.owner === owner && value.viewport !== null && value.content !== null && value.content - value.viewport > .5;
  const refresh = () => mounted.current === owner && canRefresh(latest.current) ? model.reload() : Promise.resolve();
  return <FlatList style={styles.content} data={items} keyExtractor={(item, index) => `${item.ref}:${index}`}
    renderItem={({ item, index }) => <SupplierCard item={item} model={model} index={index} />} contentContainerStyle={styles.list}
    onLayout={event => record('viewport', event.nativeEvent.layout.height)} onContentSizeChange={(_width, height) => record('content', height)}
    ItemSeparatorComponent={() => <View style={styles.separator} />} refreshControl={<RefreshControl refreshing={false} enabled={canRefresh(metrics)} onRefresh={refresh} />} />;
}

/** @v2 AdminInactiveSuppliersScreen */
export function AdminInactiveSuppliersScreen(props: AdminInactiveSuppliersScreenProps) {
  const model = useAdminInactiveSuppliers(props), { state } = model, { colors } = useBaseTheme(), insets = useSafeAreaInsets(), { width } = useWindowDimensions();
  if (!model.current || state.phase === 'invalidated') return null;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]}>
    <SafeAreaView edges={['left', 'right']} testID="admin-inactive-suppliers-header-safe-area"><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }} modifiers={[height(60)]}>
        <TopAppBar.NavigationIcon><IconButton onClick={props.navigation.onPress} modifiers={[semantics({ contentDescription: props.navigation.label }), testID('admin-inactive-suppliers-back')]}>
          <RNHostView matchContents><SymbolView name={{ android: props.navigation.icon === 'back' ? 'arrow_back' : 'menu' }} size={24} tintColor={colors.onSurface} /></RNHostView>
        </IconButton></TopAppBar.NavigationIcon>
        <TopAppBar.Title><Text style={{ fontSize: 24, fontWeight: '800' }}>{model.a('users.inactive_title')}</Text></TopAppBar.Title>
        <TopAppBar.Actions>{props.profileAction ? <RNHostView matchContents><View style={styles.profile}>{props.profileAction}</View></RNHostView> : null}</TopAppBar.Actions>
      </TopAppBar><Spacer modifiers={[height(3)]} />
    </Column></BaseHost></SafeAreaView>
    {props.topNotice}<AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-inactive-suppliers-body-frame" contentPadding="default">
      {state.phase === 'loading' ? <View style={styles.center}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View> :
        state.phase === 'error' ? <View style={styles.retry}><BaseHost matchContents={{ vertical: true }} style={{ width: Math.min(360, Math.max(280, width * .88)), maxWidth: '100%' }}>
          <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}>
            <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', lineHeight: 21.6, textAlign: 'center' }}>{model.t('serverDisconnectedRetry')}</Text>
            <TextButton onClick={model.reload} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, end: 12, top: 8, bottom: 8 }}
              modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 }), testID('admin-inactive-suppliers-retry')]}>
              <Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{model.t('retry')}</Text>
            </TextButton>
          </Column>
        </BaseHost></View> : state.items.length === 0 ? <View style={styles.center}><SoftCard><BaseHost matchContents>
          <Text style={{ typography: 'titleMedium' }}>{model.a('users.inactive_empty')}</Text>
        </BaseHost></SoftCard></View> : <SupplierList model={model} />}
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, fullWidth: { width: '100%' },
  card: { padding: 18, borderRadius: 24 }, code: { fontSize: 16, fontWeight: '500', includeFontPadding: false },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, list: { paddingTop: 4 }, separator: { height: 12 },
  retry: { flex: 1, paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
  profile: { width: 58, height: 60, justifyContent: 'center' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
