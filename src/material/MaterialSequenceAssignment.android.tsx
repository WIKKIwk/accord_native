import { CircularProgressIndicator, ExtendedFloatingActionButton, Host, IconButton, RNHostView, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { MaterialQuickScanner } from './MaterialQuickScanner.android';
import { useMaterialSequenceAssignment, type MaterialSequenceAssignmentProps } from './useMaterialSequenceAssignment';

/** @v2 _SequenceRawMaterialAssignmentSheet */
/** @v2 _SequenceAssignmentSheetHeader */
/** @v2 _SequenceAssignmentApparatusFilter */
/** @v2 _SequenceAssignmentIntro */
/** @v2 _SequenceCandidateCard */
/** @v2 _SequenceAssignedMaterialRow */
/** @v2 _SequenceMinimumRequirementCard */
/** @v2 _SequenceBulkAssignmentFab */
export function MaterialSequenceAssignment(props: MaterialSequenceAssignmentProps) {
  const h = useMaterialSequenceAssignment(props), { controller, state, t } = h, colors = useMaterialColors();
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow }}>
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: state.selectedKeys.size ? 104 : 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingVertical: 8, gap: 12 }}>
        <SymbolView name={{ android: 'inventory_2' }} size={24} tintColor={colors.onSurfaceVariant} />
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: '800' }}>{t('production.assignment.title')}</Text>
          <Text numberOfLines={2} style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>{h.headerSubtitle}</Text></View>
        <Host matchContents><IconButton onClick={() => controller.toggleScanner()}
          modifiers={[semantics({ contentDescription: t(state.scannerVisible ? 'production.assignment.qr_close' : 'production.assignment.qr_scan') }), testID('sequence-assignment-qr-scan')]}>
          <RNHostView matchContents><SymbolView name={{ android: 'qr_code_scanner' }} size={24} tintColor={state.scannerVisible ? colors.primary : colors.onSurfaceVariant} /></RNHostView>
        </IconButton></Host>
        <Host matchContents><IconButton onClick={props.onClose} modifiers={[semantics({ contentDescription: t('action.close') })]}>
          <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton></Host>
      </View>
      {state.scannerVisible ? <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}><MaterialQuickScanner busy={state.loading || h.busy}
        status={state.scannerStatus} isCurrent={controller.current} detect={value => controller.handleScan(value)} p={h.p} /></View> : null}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 4 }}>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '600' }}>{t('production.assignment.apparatus_question')}</Text>
        <DropdownFilter inline label={t('label.apparatus')}
          selectedLabel={state.selectedApparatus ? h.apparatusLabel(state.selectedApparatus) : t(h.apparatusOptions.length ? 'production.assignment.select' : 'production.assignment.not_allowed')}
          options={h.apparatusOptions.map(id => ({ value: id, label: h.apparatusLabel(id) }))}
          enabled={!h.busy && h.apparatusOptions.length > 0} backgroundColor={colors.surfaceContainerLow} onChange={value => controller.selectApparatus(value)} />
      </View>
      {!!state.actionMessage && <Text accessibilityLiveRegion="polite" style={{ color: state.actionSucceeded ? colors.primary : colors.error,
        fontSize: 12, fontWeight: '700', marginHorizontal: 16, marginBottom: 8 }}>{state.actionMessage}</Text>}
      {!h.apparatusOptions.length ? <View style={{ paddingHorizontal: 16, gap: 6 }}>
        <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{t('production.assignment.apparatus_access_title')}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{t('production.assignment.apparatus_access_message')}</Text>
      </View> : state.loading ? <ActivityIndicator style={{ height: 156 }} /> : state.loadError ? <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{t('production.assignment.load_failed')}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{state.loadError}</Text>
        <WorkerSheetButton label={t('production.qolip_retry')} variant="text" onPress={() => { void controller.load(); }} />
      </View> : <View style={{ paddingHorizontal: 16 }}>
        {h.candidates.length ? <View style={{ gap: 7, marginBottom: 10 }}>
          <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: '800' }}>{t('production.assignment.candidate_count', { count: h.candidates.length })}</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{t('production.assignment.match_hint')}</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{t('production.assignment.multi_hint')}</Text>
          {!!h.widthRequirement && <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{h.widthRequirement}</Text>}
          {!!h.assignments.length && <Text style={{ color: colors.onSurfaceVariant }}>{t('production.assignment.assigned_count', { count: h.assignments.length })}</Text>}
        </View> : <View style={{ gap: 7, paddingVertical: 16, alignItems: h.assignments.length ? 'stretch' : 'center' }}>
          <Text style={{ color: colors.onSurface, fontWeight: '800', fontSize: 16 }}>{t(h.assignments.length ? 'production.assignment.all_linked' : 'production.assignment.no_matching')}</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{t(h.assignments.length ? 'production.assignment.refresh_hint' : 'production.assignment.no_stock')}</Text>
          {!!h.widthRequirement && <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{h.widthRequirement}</Text>}
          <WorkerSheetButton label={t('action.retry')} variant="text" onPress={() => { void controller.load(); }} />
        </View>}
        {h.candidates.map(item => <Pressable key={item.key} accessibilityRole="button" disabled={item.busy}
          onPress={() => controller.candidateAction(item.raw)} onLongPress={() => controller.toggleSelection(item.raw)}
          style={{ borderRadius: 18, borderWidth: item.selected ? 1.5 : 1, borderColor: item.selected ? colors.primary : colors.outlineVariant,
            backgroundColor: item.selected ? colors.primaryContainer : colors.surfaceContainerLow, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: item.selected ? colors.primary : colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
              {item.selected ? <SymbolView name={{ android: 'check' }} size={20} tintColor={colors.onPrimary} /> : <Text style={{ color: colors.onSecondaryContainer, fontWeight: '900' }}>#{item.rank}</Text>}
            </View><View style={{ flex: 1, gap: 4 }}><Text numberOfLines={2} style={{ color: colors.onSurface, fontSize: 16, fontWeight: '800' }}>{item.title}</Text>
              {!!item.subtitle && <Text numberOfLines={2} style={{ color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 15 }}>{item.subtitle}</Text>}
            </View><Text style={{ color: colors.onSurfaceVariant, fontSize: 11, fontWeight: '800', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.surfaceContainerHighest }}>{item.matchLabel}</Text>
          </View>
          {item.details.map((detail, index) => <Text key={index} style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{detail}</Text>)}
          {!!item.groupApparatus && <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{item.groupApparatus}</Text>}
          <WorkerSheetButton label={item.actionLabel} variant={item.selectionMode ? 'outlined' : 'filled'} height={48}
            icon={{ android: item.selectionMode ? item.selected ? 'check' : 'check_box_outline_blank' : 'link' }} disabled={item.busy}
            onPress={() => controller.candidateAction(item.raw)} />
          {item.busy ? <ActivityIndicator size="small" /> : null}
        </Pressable>)}
        {!!h.assignments.length && <View style={{ paddingTop: 8, gap: 8 }}>
          <Text style={{ color: colors.onSurface, fontWeight: '800', fontSize: 14, marginBottom: 0 }}>{t('production.assignment.connected_title')}</Text>
          {h.assignments.map(item => <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.surfaceContainerHigh }}>
            <SymbolView name={{ android: 'check_circle_outline' }} size={22} tintColor={colors.primary} />
            <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.onSurface, fontWeight: '700' }}>{item.title}</Text>
              {!!item.subtitle && <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{item.subtitle}</Text>}</View>
          </View>)}
        </View>}
      </View>}
    </ScrollView>
    {!!state.selectedKeys.size && <Host matchContents style={{ position: 'absolute', right: 16, bottom: 16 }}>
      <ExtendedFloatingActionButton onClick={() => { if (!state.bulkAssigning) void controller.assignSelected(); }}
        modifiers={[testID('sequence-assignment-bulk')]}>
        <ExtendedFloatingActionButton.Icon>{state.bulkAssigning ? <CircularProgressIndicator modifiers={[size(22, 22)]} />
          : <RNHostView matchContents><SymbolView name={{ android: 'link' }} size={24} tintColor={colors.onPrimaryContainer} /></RNHostView>}</ExtendedFloatingActionButton.Icon>
        <ExtendedFloatingActionButton.Text><ComposeText>{t('production.assignment.link_count', { count: state.selectedKeys.size })}</ComposeText></ExtendedFloatingActionButton.Text>
      </ExtendedFloatingActionButton>
    </Host>}
  </View>;
}
