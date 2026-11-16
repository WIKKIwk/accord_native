import { Button, DisclosureGroup, Grid, HStack, Image, List, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, animation, Animation, background, buttonStyle, clipped, cornerRadius, disabled, font, foregroundStyle, frame,
  lineLimit, listRowInsets, listRowSeparator, listStyle, multilineTextAlignment, onAppear, opacity, padding, refreshable, scrollContentBackground, useScrollGeometryChange } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PlatformColor, StyleSheet, View } from 'react-native';
import type { SearchBarCommands } from 'react-native-screens';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { AdminUsersRow, AdminUsersScreenProps } from './AdminUsersScreenTypes';
import { useAdminUsersScreen, type AdminUsersScreenModel } from './useAdminUsersScreen';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';

function RoleFilter({ model }: { model: AdminUsersScreenModel }) {
  const pairs = Array.from({ length: Math.ceil(model.roleOptions.length / 2) }, (_, index) => model.roleOptions.slice(index * 2, index * 2 + 2));
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
    <DisclosureGroup label={model.roleLabel} isExpanded={model.state.roleMenuOpen} onIsExpandedChange={model.toggleRoles}
      modifiers={[padding({ horizontal: 12, vertical: 8 }), accessibilityIdentifier('admin-users-role-filter-chip')]}>
      <Grid alignment="leading" horizontalSpacing={8} verticalSpacing={8} modifiers={[padding({ top: 8 }), frame({ maxWidth: Infinity })]}>
        {pairs.map((pair, index) => <Grid.Row key={index}>{pair.map(option => <Button key={option.kind} label={option.label}
          systemImage={option.selected ? 'checkmark' : undefined} onPress={() => model.selectRole(option.kind)}
          modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity }), accessibilityIdentifier(`admin-users-role-option-chip-${option.kind}`)]} />)}</Grid.Row>)}
      </Grid>
    </DisclosureGroup>
  </BaseHost>;
}
function UserRow({ item, model }: { item: AdminUsersRow; model: AdminUsersScreenModel }) {
  const { colors } = useBaseTheme(), [entry, setEntry] = useState({ key: item.key, entered: !item.entering });
  const entered = !item.entering || (entry.key === item.key && entry.entered), visible = entered && !item.exiting;
  useEffect(() => {
    if (!item.entering) return;
    const request = requestAnimationFrame(() => setEntry({ key: item.key, entered: true }));
    return () => cancelAnimationFrame(request);
  }, [item.key, item.entering]);
  return <VStack modifiers={[frame({ height: visible ? undefined : 0 }), opacity(visible ? 1 : 0), clipped(),
    animation(Animation.easeOut({ duration: .18 }), visible), listRowSeparator('hidden'), listRowInsets({ top: 0, leading: 4, bottom: 2, trailing: 4 }),
    onAppear(() => { if (Number(Platform.Version) < 18 && item.index === item.count - 1) void model.loadMore(); })]}>
    <Button onPress={() => { void model.openUser(item.id); }} modifiers={[buttonStyle('plain'), disabled(item.exiting), accessibilityIdentifier(`admin-user-${item.id}`)]}>
      <HStack spacing={14} modifiers={[padding({ leading: 14, trailing: 10, vertical: 8 }), frame({ maxWidth: Infinity, minHeight: 61, alignment: 'leading' })]}>
        <Image systemName="person" size={16} modifiers={[frame({ width: 30, height: 30 }), background(colors.secondaryContainer), cornerRadius(8), foregroundStyle(colors.onSecondaryContainer)]} />
        <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{item.title}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{item.subtitle}</Text>
        </VStack>
      </HStack>
    </Button>
  </VStack>;
}
// @v2 AdminSuppliersScreen, role picker and unified user rows. The owner supplies real held detail navigation.
export function AdminUsersScreen(props: AdminUsersScreenProps) {
  const model = useAdminUsersScreen(props), { state } = model, search = useRef<SearchBarCommands>(null);
  const cancelledSearch = useRef<{ identity: typeof model.identity; generation: number; text: string } | null>(null);
  const lastTyped = useRef<{ identity: typeof model.identity; generation: number; text: string } | null>(null);
  const { current, searchText, searchFocused, identity } = model;
  const geometry = useScrollGeometryChange(value => model.scrollMetrics(value.containerHeight, value.contentHeight - value.contentOffsetY - value.containerHeight));
  useEffect(() => {
    const typed = lastTyped.current;
    if (typed?.identity === identity && typed.generation === model.generation && typed.text !== searchText) return;
    if (current()) search.current?.setText(searchText);
  }, [searchText, searchFocused, identity, current, model.generation]);
  const renderRow = useCallback(({ item }: { item: AdminUsersRow }) => <UserRow item={item} model={model} />, [model]);
  const cancelSearch = () => {
    if (!model.interactive()) return;
    const typed = lastTyped.current, text = typed?.identity === model.identity && typed.generation === model.generation ? typed.text : model.searchText;
    cancelledSearch.current = { identity: model.identity, generation: model.generation, text };
    model.setSearchFocused(false); search.current?.setText(text);
  };
  const changeSearch = (text: string) => {
    const cancelled = cancelledSearch.current; cancelledSearch.current = null;
    // RNSSearchBar emits Cancel and then an empty change. V2's focus-close retains its text and filter.
    if (cancelled && text === '') {
      if (cancelled.identity === model.identity && cancelled.generation === model.generation && model.interactive()) search.current?.setText(cancelled.text);
      return;
    }
    if (model.interactive()) lastTyped.current = { identity: model.identity, generation: model.generation, text };
    model.setSearch(text);
  };
  if (!model.current()) return null;
  return <>
    <Stack.Screen options={{ headerShown: true, title: '', headerLargeTitle: false, headerShadowVisible: false, headerBackVisible: false,
      headerLeft: model.searchFocused ? undefined : () => <RoleHeaderButton icon="back" label={props.backLabel} onPress={model.back} tintColor={PlatformColor('label')} />,
      headerRight: model.searchFocused ? undefined : () => props.profileAction,
      headerSearchBarOptions: { ref: search, placeholder: model.a('users.search'), hideWhenScrolling: false, hideNavigationBar: false, obscureBackground: false,
        autoCapitalize: 'none', cancelButtonText: model.a('action.close'), onChangeText: event => changeSearch(event.nativeEvent.text),
        onFocus: () => model.setSearchFocused(true), onBlur: () => model.setSearchFocused(false), onCancelButtonPress: cancelSearch,
        onSearchButtonPress: () => { if (model.interactive()) { search.current?.blur(); model.setSearchFocused(false); } } } }} />
    <View style={styles.screen}>
      <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-users-body-frame"><View style={styles.content}>
      {!model.salesManager ? <RoleFilter model={model} /> : null}
      <View style={styles.content}>
        <BaseHost style={styles.content}>
          <List key={state.scrollResetSerial} modifiers={[listStyle('plain'), scrollContentBackground('hidden'),
            opacity(state.screen === 'content' ? 1 : 0), disabled(state.screen !== 'content'), accessibilityHidden(state.screen !== 'content'),
            refreshable(model.reload), ...(geometry ? [geometry] : [])]}>
            <List.ForEach data={model.rows} keyExtractor={row => row.key} estimatedItemSize={63}>{renderRow}</List.ForEach>
            {!model.rows.length ? <Text modifiers={[font({ textStyle: 'body' }), listRowSeparator('hidden'), padding({ horizontal: 8, vertical: 12 })]}>{model.a('users.not_found')}</Text> : null}
            {model.showFooter ? <VStack modifiers={[padding({ top: 14 }), listRowSeparator('hidden')]}>{state.loadingMore ? <ProgressView /> : null}</VStack> : null}
            <Spacer modifiers={[frame({ height: 116 }), listRowSeparator('hidden')]} />
          </List>
        </BaseHost>
        {state.screen !== 'content' ? <View style={styles.overlay}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
          <VStack spacing={16} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 24, vertical: 16 })]}>
            {state.screen === 'loading' ? <ProgressView /> : <Text modifiers={[font({ textStyle: 'body' }), multilineTextAlignment('center')]}>{model.a(state.screen === 'unselected' ? 'users.not_selected' : 'users.load_failed')}</Text>}
            {state.screen === 'error' ? <Button label={model.t('retry')} onPress={() => { void model.reload(); }} /> : null}
          </VStack>
        </BaseHost></View> : null}
      </View>
      </View></AdminShellBodyFrame>
      {props.footer}
      {state.notice ? <PreparationNotice message={model.a(state.notice.key)} /> : null}
    </View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, fullWidth: { width: '100%' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' } });
