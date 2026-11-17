import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { localizedGetter } from '../shared/localization';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { QolipSetNameDialog } from './QolipSetNameDialog';
import { qolipVisibleColor } from './qolipColorPresentation';
import { useQolipSetsScreen } from './useQolipSetsScreen';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** @v2 QolipSetsScreen */
export function QolipSetsScreen() {
  const h = useQolipSetsScreen(), c = useWorkerColors(), insets = useSafeAreaInsets();
  if (!h.role.isCurrent()) return null;
  return <View style={{ flex: 1, paddingTop: insets.top }}><OrdersHeader search={h.query} searchPlaceholder={h.m('search')} onSearchChange={h.setQuery} onMenu={h.role.onMenu} onProfile={h.role.onProfile} />
    {h.loading ? <ActivityIndicator style={{ margin: 32 }} /> : h.error ? <View style={{ padding: 20, gap: 12 }}><Text style={{ color: c.text }}>{localizedGetter('serverDisconnectedRetry', h.locale)}</Text><WorkerSheetButton label={localizedGetter('retry', h.locale)} onPress={() => void h.reload()} /></View>
      : <FlatList data={h.entries} keyExtractor={entry => entry.set.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 112 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void h.reload()} />}
        ListEmptyComponent={<Text style={{ color: c.muted, padding: 32, textAlign: 'center' }}>{h.m('empty')}</Text>}
        renderItem={({ item: entry, index }) => <WorkerQueueCard first={index === 0} last={index === h.entries.length - 1} backgroundColor={c.surface}
          onPress={() => h.toggle(entry)} onLongPress={() => { if (!h.saving) h.setActionsEntry(entry); }} disabled={h.saving} style={{ alignItems: 'stretch' }}>
          <View style={{ flex: 1, gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ backgroundColor: c.field, borderRadius: 12, padding: 10 }}><SymbolView name={{ android: 'layers' }} size={22} tintColor={c.icon} /></View>
            <View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{entry.display_name}</Text>
              <Text style={{ color: c.muted }}>{[entry.name ? entry.set.id : '', h.t('products.mold_count', { count: entry.set.members.length })].filter(Boolean).join(' · ')}</Text></View>
            <Pressable accessibilityLabel={h.m('copy_code')} onPress={() => void h.copy(entry.set.id)}><SymbolView name={{ android: 'content_copy' }} size={20} tintColor={c.icon} /></Pressable>
            <SymbolView name={{ android: h.expanded === entry.set.id ? 'expand_less' : 'expand_more' }} size={22} tintColor={c.icon} />
          </View>{h.expanded === entry.set.id && <View style={{ paddingHorizontal: 6, paddingBottom: 8, gap: 10 }}>
            <Text style={{ color: c.text }}>{h.m('linked', { count: entry.set.product_labels.length })}</Text>
            {entry.set.product_labels.length > 0 && <Text style={{ color: c.muted }}>{entry.set.product_labels.join(', ')}</Text>}
            {entry.set.members.map((member, index) => { const color = qolipVisibleColor(member.color); return <Pressable key={`${member.qolip_code}:${index}`} onPress={() => void h.copy(member.qolip_code)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <SymbolView name={{ android: member.is_in_use ? 'lock_outline' : 'qr_code_2' }} size={18} tintColor={c.icon} />
              {color && <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color, borderColor: c.muted, borderWidth: 1 }} />}
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{member.qolip_code}</Text><Text style={{ color: c.muted }}>{member.is_in_use ? h.t('products.issued') : member.size > 0 ? h.t('products.size_value', { size: member.size }) : ''}</Text></View>
              <Pressable disabled={h.saving || member.is_in_use} accessibilityLabel={h.t('action.delete')} onPress={() => void h.remove(entry, member)}><SymbolView name={{ android: 'delete_outline' }} size={22} tintColor={h.saving || member.is_in_use ? c.muted : c.icon} /></Pressable>
            </Pressable>; })}
            <WorkerSheetButton label={h.m('add')} disabled={h.saving} onPress={() => void h.add(entry)} variant="filled" height={54} />
          </View>}</View>
        </WorkerQueueCard>} />}
    {h.role.dock}{h.actionsEntry && <WorkerOrderSheet dismissible compact fitContent onClose={() => h.setActionsEntry(null)}><View style={{ padding: 16, gap: 12 }}>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>{h.actionsEntry.display_name}</Text>{!!h.actionsEntry.name && <Text style={{ color: c.muted }}>{h.actionsEntry.set.id}</Text>}
      <WorkerSheetButton label={h.m('rename')} onPress={h.openRename} />
    </View></WorkerOrderSheet>}{h.rename && <QolipSetNameDialog session={h.role.session} entry={h.rename} close={h.closeRename} saved={h.renamed} isCurrent={h.role.isCurrent} />}
    {h.editor.content}
  </View>;
}
