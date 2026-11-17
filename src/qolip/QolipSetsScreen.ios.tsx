import { Button, Circle, Host, HStack, Image, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, foregroundStyle, frame, labelStyle, listStyle, onLongPressGesture, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Text as NativeText, View } from 'react-native';
import { localizedGetter } from '../shared/localization';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { QolipSetNameDialog } from './QolipSetNameDialog';
import { qolipVisibleColor } from './qolipColorPresentation';
import { useQolipSetsScreen } from './useQolipSetsScreen';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** @v2 QolipSetsScreen */
export function QolipSetsScreen() {
  const h = useQolipSetsScreen(), insets = useSafeAreaInsets(), colors = useWorkerColors(); if (!h.role.isCurrent()) return null;
  return <View style={{ flex: 1, paddingTop: insets.top }}><OrdersHeader search={h.query} searchPlaceholder={h.m('search')} onSearchChange={h.setQuery} onMenu={h.role.onMenu} onProfile={h.role.onProfile} />
    <Host style={{ flex: 1 }}><List modifiers={[listStyle('plain'), refreshable(() => h.reload())]}>
      {h.loading ? <Section><ProgressView /></Section> : h.error ? <Section><Text>{localizedGetter('serverDisconnectedRetry', h.locale)}</Text><Button label={localizedGetter('retry', h.locale)} onPress={() => { void h.reload(); }} /></Section>
        : h.entries.length === 0 ? <Section><Text>{h.m('empty')}</Text></Section> : h.entries.map(entry => <Section key={entry.set.id}>
          <HStack spacing={10}><Image systemName="square.stack.3d.up" /><Button onPress={() => h.toggle(entry)} modifiers={[disabled(h.saving), frame({ maxWidth: Infinity, alignment: 'leading' }), onLongPressGesture(() => { if (!h.saving) h.setActionsEntry(entry); })]}>
            <VStack alignment="leading" spacing={4}><Text modifiers={[font({ weight: 'bold' })]}>{entry.display_name}</Text>
              <Text>{[entry.name ? entry.set.id : '', h.t('products.mold_count', { count: entry.set.members.length })].filter(Boolean).join(' · ')}</Text></VStack></Button>
            <Button label={h.m('copy_code')} systemImage="doc.on.doc" onPress={() => { void h.copy(entry.set.id); }} modifiers={[labelStyle('iconOnly')]} />
            <Image systemName={h.expanded === entry.set.id ? 'chevron.up' : 'chevron.down'} />
          </HStack>{h.expanded === entry.set.id && <VStack alignment="leading" spacing={10}>
            <Text>{h.m('linked', { count: entry.set.product_labels.length })}</Text>
            {entry.set.product_labels.length > 0 && <Text>{entry.set.product_labels.join(', ')}</Text>}
            {entry.set.members.map((member, index) => { const color = qolipVisibleColor(member.color); return <HStack key={`${member.qolip_code}:${index}`} spacing={8}>
              <Image systemName={member.is_in_use ? 'lock' : 'qrcode'} />{color && <Circle modifiers={[frame({ width: 16, height: 16 }), foregroundStyle(color)]} />}
              <Button onPress={() => { void h.copy(member.qolip_code); }} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><VStack alignment="leading" spacing={4}>
                <Text modifiers={[font({ weight: 'bold' })]}>{member.qolip_code}</Text><Text>{member.is_in_use ? h.t('products.issued') : member.size > 0 ? h.t('products.size_value', { size: member.size }) : ''}</Text>
              </VStack></Button><Button label={h.t('action.delete')} systemImage="trash" role="destructive" onPress={() => { void h.remove(entry, member); }} modifiers={[labelStyle('iconOnly'), disabled(h.saving || member.is_in_use)]} />
            </HStack>; })}
            <Button label={h.m('add')} systemImage="plus" onPress={() => { void h.add(entry); }} modifiers={[buttonStyle('borderedProminent'), disabled(h.saving), frame({ maxWidth: Infinity, minHeight: 50 })]} />
          </VStack>}
        </Section>)}
    </List></Host>
    {h.actionsEntry && <WorkerOrderSheet dismissible compact fitContent onClose={() => h.setActionsEntry(null)}><View style={{ padding: 16, gap: 12 }}>
      <NativeText style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{h.actionsEntry.display_name}</NativeText>{!!h.actionsEntry.name && <NativeText style={{ color: colors.muted }}>{h.actionsEntry.set.id}</NativeText>}
      <WorkerSheetButton label={h.m('rename')} onPress={h.openRename} />
    </View></WorkerOrderSheet>}{h.rename && <QolipSetNameDialog session={h.role.session} entry={h.rename} close={h.closeRename} saved={h.renamed} isCurrent={h.role.isCurrent} />}{h.editor.content}
  </View>;
}
