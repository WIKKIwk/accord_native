import { Button, Host, HStack, Image, List, Picker, ProgressView, Section, Spacer, TabView, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, frame, onAppear, padding, pickerStyle, refreshable, tabViewStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { KeyboardAvoidingView, Modal, PlatformColor, Pressable, ScrollView, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { localizedGetter } from '../shared/localization';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { AdminCreateMenu } from './AdminCreateMenu.ios';
import { ItemGroupsDialogContent } from './ItemGroupsDialogContent';
import { ItemGroupsPickerSheet } from './ItemGroupsPickerSheet.ios';
import { itemGroupsVisibleTree } from './itemGroupsModel';
import { useItemGroupsRoute, type ItemGroupsRouteProps } from './useItemGroupsRoute';

/** @v2 AdminItemGroupCreateScreen */
export function ItemGroupsRoute(props: ItemGroupsRouteProps) {
  const model = useItemGroupsRoute(props), { state, controller, t, roots, displayGroups } = model, { height } = useWindowDimensions();
  const rows = itemGroupsVisibleTree(roots, state.expanded);
  const actions = useMemo(() => [
    { id: 'item-group-create', label: t('item_group.add'), icon: { ios: 'folder.badge.plus' as const, android: 'create_new_folder' as const }, onPress: () => { void controller.open('create'); } },
    { id: 'item-group-move', label: t('item_group.move_parent'), icon: { ios: 'folder' as const, android: 'drive_file_move' as const }, onPress: () => { void controller.open('move'); } },
  ], [controller, t]);
  if (!state.valid || !model.current()) return null;
  const notice = state.notice ? <View pointerEvents="none" accessibilityRole="alert" style={[styles.notice, state.notice.success ? styles.success : styles.failure]}>
    <NativeText style={{ color: PlatformColor('label') }}>{t(state.notice.key, state.notice.values)}</NativeText></View> : null;
  return <View style={{ flex: 1 }}>
    <Stack.Screen options={{ headerShown: true, title: t('item_group.title'), headerLeft: props.navigation ? () => <RoleHeaderButton {...props.navigation!} tintColor={PlatformColor('label')} /> : undefined }} />
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Picker label="" selection={state.tab} onSelectionChange={value => { if (value === 'tree' || value === 'items') controller.setTab(value); }}
        modifiers={[pickerStyle('segmented'), padding({ horizontal: 12, bottom: 4 })]}>
        <Text modifiers={[tag('tree')]}>{t('item_group.tree_tab')}</Text><Text modifiers={[tag('items')]}>{t('item_group.items_tab')}</Text>
      </Picker>
    </Host>
    <Host style={{ flex: 1 }}><TabView selection={state.tab} onSelectionChange={value => { if (value === 'tree' || value === 'items') controller.setTab(value); }}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), tabViewStyle({ type: 'page', indexDisplayMode: 'never' }), disabled(!model.focused || !!state.dialog)]}>
      <TabView.Tab value="tree">{state.treePhase === 'loading' ? <ProgressView /> : state.treePhase === 'error' ? <Text>{t('item_group.tree_load_failed')}</Text> :
        <List modifiers={[refreshable(() => controller.reload())]}>
          <Section><Text modifiers={[font({ textStyle: 'headline' })]}>{t('item_group.tree_title')}</Text><Text>{t('item_group.tree_description')}</Text></Section>
          {!rows.length ? <Text>{t('item_group.tree_empty')}</Text> : rows.map(({ node, depth }) => <HStack key={node.entry.name} spacing={8} modifiers={[padding({ leading: depth * 17 })]}>
            {node.children.length ? <Button onPress={() => controller.toggle(node.entry.name)} modifiers={[buttonStyle('plain')]}>
              <HStack><Image systemName={state.expanded.has(node.entry.name) ? 'folder.fill' : 'folder'} /><Text>{node.entry.item_group_name || node.entry.name}</Text></HStack>
            </Button> : <HStack><Image systemName="tag" /><Text>{node.entry.item_group_name || node.entry.name}</Text></HStack>}<Spacer /><Button label={t('item_group.show')} onPress={() => controller.selectGroup(node.entry.name)} />
            <Text modifiers={[font({ textStyle: 'caption' })]}>{node.children.length ? t('item_group.children_count', { count: node.children.length }) : t('item_group.leaf')}</Text>
          </HStack>)}
        </List>}</TabView.Tab>
      <TabView.Tab value="items"><List modifiers={[refreshable(() => controller.loadItems(true))]}>
          <Section><Text modifiers={[font({ textStyle: 'title2' })]}>{t('item_group.items_title')}</Text><Text>{t('item_group.items_description')}</Text>
            {state.parentsPhase === 'loading' ? <ProgressView /> : state.parentsPhase === 'error' ? <Text>{t('item_group.load_failed')}</Text> : displayGroups.length ? <>
              <Button label={`${t('item_group.group')}: ${state.selectedGroup || t('item_group.not_selected')}`} onPress={() => controller.toggleFilter()} />
              {state.filterExpanded ? displayGroups.map(group => <Button key={group} label={group} onPress={() => controller.selectGroup(group)}
                modifiers={[buttonStyle(group === state.selectedGroup ? 'borderedProminent' : 'bordered')]} />) : null}
            </> : <Text>{t('item_group.not_found')}</Text>}
          </Section>
          {!state.selectedGroup ? <Text>{t('item_group.tree_show_hint')}</Text> : state.itemsLoading ? <ProgressView /> : state.itemsError && !state.items.length ?
            <Section><Text>{t('item_group.items_load_failed')}</Text><Button label={t('action.retry')} onPress={() => { void controller.loadItems(true); }} /></Section> : <>
              <Section><HStack><Text modifiers={[font({ textStyle: 'headline' })]}>{state.selectedGroup}</Text><Spacer /><Text>{t('item_group.item_count', { count: state.items.length })}</Text></HStack></Section>
              {!state.items.length ? <Text>{t('item_group.no_items')}</Text> : state.items.map((item, index) => <HStack key={`${index}:${item.code}`}
                modifiers={index === state.items.length - 1 && state.hasMore ? [onAppear(() => { void controller.loadItems(false); })] : []}>
                <Image systemName="square.grid.2x2" /><VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                  <Text modifiers={[font({ textStyle: 'body', weight: 'bold' })]}>{item.name.trim() ? item.name : item.code}</Text>
                  <Text modifiers={[font({ textStyle: 'caption' })]}>{[item.code.trim(), item.uom.trim()].filter(Boolean).join(' • ')}</Text>
                </VStack>
              </HStack>)}
              {state.loadingMore ? <ProgressView /> : state.itemsError ? <Button label={t('item_group.load_more')} onPress={() => { void controller.loadItems(true); }} /> : state.hasMore ? <Text>{t('item_group.scroll_hint')}</Text> : null}
            </>}
        </List></TabView.Tab>
    </TabView></Host>
    {props.footer}
    <AdminCreateMenu actions={actions} isCurrent={model.current} openLabel={localizedGetter('adminCreateTitle', model.locale)} closeLabel={t('action.close')} visible={!state.dialog && model.focused} />
    {state.dialog ? <Modal visible={model.focused} transparent animationType="fade" onRequestClose={() => controller.closeDialog(state.dialog!.id)}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => controller.closeDialog(state.dialog!.id)} />
        <View accessibilityViewIsModal style={styles.dialog}><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.76, flexGrow: 0 }}>
          <ItemGroupsDialogContent dialog={state.dialog} model={model} />
        </ScrollView></View>
        {state.picker ? <ItemGroupsPickerSheet key={state.picker.id} model={model} /> : null}
        {notice}
      </KeyboardAvoidingView>
    </Modal> : null}
    {!state.dialog ? notice : null}
  </View>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.32)' },
  dialog: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: 18, overflow: 'hidden', backgroundColor: PlatformColor('secondarySystemGroupedBackground') },
  notice: { position: 'absolute', left: 16, right: 16, top: 16, borderRadius: 12, padding: 14 },
  success: { backgroundColor: PlatformColor('secondarySystemBackground') }, failure: { top: undefined, bottom: 16, backgroundColor: PlatformColor('secondarySystemBackground') } });
