import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { useWorkerColors } from '../components/useWorkerColors';
import type { ItemGroupsDialog } from './itemGroupsController';
import type { ItemGroupsRouteModel } from './useItemGroupsRoute';
import { itemGroupsMoveChoices } from './itemGroupsModel';
import { ItemGroupsNameField } from './ItemGroupsNameField';
import { ItemGroupsPickerField } from './ItemGroupsPickerField';
import { ItemGroupsActionButton } from './ItemGroupsActionButton';
import { ItemGroupsTypeSwitch } from './ItemGroupsTypeSwitch';

export function ItemGroupsDialogContent({ dialog, model }: { dialog: ItemGroupsDialog; model: ItemGroupsRouteModel }) {
  const { controller, t } = model, colors = useWorkerColors();
  const choices = itemGroupsMoveChoices(dialog.groups, dialog.group), pickerOpen = model.state.picker !== null;
  return <View style={[styles.content, { backgroundColor: colors.surface }]}>
    <View style={styles.header}><Text style={[styles.title, { color: colors.text }]}>{t(dialog.kind === 'create' ? 'item_group.create_title' : 'item_group.parent_move_title')}</Text>
      <View style={{ opacity: dialog.kind === 'create' && dialog.saving ? 0.4 : 1 }} pointerEvents={pickerOpen || (dialog.kind === 'create' && dialog.saving) ? 'none' : 'auto'}>
        <WorkerIconButton icon="close" label={t('action.close')} onPress={() => controller.closeDialog(dialog.id)} />
      </View>
    </View>
    {dialog.kind === 'create' ? <>
      <ItemGroupsNameField label={t('item_group.name')} initial={dialog.name} enabled={!pickerOpen} onChange={value => controller.setName(dialog.id, value)} />
      <ItemGroupsPickerField label={t('item_group.parent')} value={dialog.parent} placeholder={t(dialog.phase === 'loading' ? 'action.loading' : 'item_group.parent_placeholder')}
        enabled={dialog.phase === 'ready' && !dialog.saving && !pickerOpen} onPress={() => controller.openPicker(dialog.id, 'createParent')} />
      <ItemGroupsTypeSwitch label={t('item_group.group_type')} hint={t('item_group.group_type_hint')} value={dialog.isGroup}
        disabled={dialog.saving || pickerOpen} onChange={value => controller.setIsGroup(dialog.id, value)} />
      <View style={{ marginTop: 2 }}><ItemGroupsActionButton label={t(dialog.saving ? 'item_group.creating' : 'item_group.create_action')}
        disabled={dialog.saving || pickerOpen} onPress={() => { void controller.submit(dialog.id); }} /></View>
    </> : dialog.phase === 'loading' ? <ActivityIndicator /> : dialog.phase === 'error' || !dialog.groups.length ?
      <Text style={{ color: colors.muted, paddingVertical: 24, textAlign: 'center' }}>{t('item_group.load_failed')}</Text> : <View style={{ padding: 14, gap: 12 }}>
        <ItemGroupsPickerField label={t('item_group.movable_group')} value={dialog.group} placeholder={t('item_group.group_select')}
          enabled={!dialog.saving && choices.groups.length > 0 && !pickerOpen} onPress={() => controller.openPicker(dialog.id, 'moveGroup')} />
        <ItemGroupsPickerField label={t('item_group.new_parent')} value={dialog.parent} placeholder={t('item_group.parent_placeholder')}
          enabled={!dialog.saving && choices.parents.length > 0 && !pickerOpen} onPress={() => controller.openPicker(dialog.id, 'moveParent')} />
        <View style={{ marginTop: 2 }}><ItemGroupsActionButton label={t(dialog.saving ? 'item_group.moving' : 'item_group.move_action')}
          disabled={dialog.saving || !dialog.group || !dialog.parent || pickerOpen} onPress={() => { void controller.submit(dialog.id); }} /></View>
      </View>}
  </View>;
}
const styles = StyleSheet.create({ content: { padding: 16, gap: 12, borderRadius: 18 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: '800' } });
