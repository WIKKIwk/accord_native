import { Button, Host, HStack, Image, List, Picker, ProgressView, RNHostView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, contentShape, disabled, font, foregroundStyle, frame, onLongPressGesture, onTapGesture, padding, pickerStyle, shapes, tag } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { MaterialQuickScanner } from './MaterialQuickScanner.ios';
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
  const h = useMaterialSequenceAssignment(props), { controller, state, t } = h;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  if (!controller.current()) return null;
  return <Host style={{ flex: 1 }}><VStack spacing={0}>
    <HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 10 })]}>
      <Image systemName="shippingbox" size={24} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{t('production.assignment.title')}</Text>
        <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{h.headerSubtitle}</Text>
      </VStack>
      <Button systemImage="qrcode.viewfinder" label={t(state.scannerVisible ? 'production.assignment.qr_close' : 'production.assignment.qr_scan')}
        onPress={() => controller.toggleScanner()} modifiers={[buttonStyle('bordered'), frame({ minHeight: 44 })]} />
      <Button systemImage="xmark" label={t('action.close')} onPress={props.onClose} modifiers={[buttonStyle('bordered'), frame({ minHeight: 44 })]} />
    </HStack>
    <List>
      {state.scannerVisible && <Section><RNHostView matchContents><MaterialQuickScanner busy={state.loading || h.busy} status={state.scannerStatus}
        isCurrent={controller.current} detect={value => controller.handleScan(value)} p={h.p} /></RNHostView></Section>}
      <Section><Text modifiers={[secondary]}>{t('production.assignment.apparatus_question')}</Text>
        <Picker label={t('label.apparatus')} selection={state.selectedApparatus} onSelectionChange={value => {
          if (typeof value === 'string') controller.selectApparatus(value);
        }} modifiers={[pickerStyle('menu'), disabled(h.busy || !h.apparatusOptions.length)]}>
          {h.apparatusOptions.length ? h.apparatusOptions.map(id => <Text key={id} modifiers={[tag(id)]}>{h.apparatusLabel(id)}</Text>)
            : <Text modifiers={[tag('')]}>{t('production.assignment.not_allowed')}</Text>}
        </Picker>
      </Section>
      {!!state.actionMessage && <Section><Text modifiers={[foregroundStyle(PlatformColor(state.actionSucceeded ? 'systemGreen' : 'systemRed'))]}>{state.actionMessage}</Text></Section>}
      {!h.apparatusOptions.length ? <Section><Text>{t('production.assignment.apparatus_access_title')}</Text><Text>{t('production.assignment.apparatus_access_message')}</Text></Section>
        : state.loading ? <ProgressView /> : state.loadError ? <Section><Text>{t('production.assignment.load_failed')}</Text><Text>{state.loadError}</Text>
          <Button label={t('production.qolip_retry')} onPress={() => { void controller.load(); }} /></Section> : <>
          {h.candidates.length ? <Section><Text modifiers={[font({ textStyle: 'headline' })]}>{t('production.assignment.candidate_count', { count: h.candidates.length })}</Text>
            <Text>{t('production.assignment.match_hint')}</Text><Text>{t('production.assignment.multi_hint')}</Text>
            {!!h.widthRequirement && <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{h.widthRequirement}</Text>}
            {!!h.assignments.length && <Text>{t('production.assignment.assigned_count', { count: h.assignments.length })}</Text>}
          </Section> : <Section><Text modifiers={[font({ textStyle: 'headline' })]}>{t(h.assignments.length ? 'production.assignment.all_linked' : 'production.assignment.no_matching')}</Text>
            <Text>{t(h.assignments.length ? 'production.assignment.refresh_hint' : 'production.assignment.no_stock')}</Text>
            {!!h.widthRequirement && <Text>{h.widthRequirement}</Text>}
            <Button label={t('action.retry')} onPress={() => { void controller.load(); }} />
          </Section>}
          {h.candidates.map(item => <Section key={item.key}><VStack alignment="leading" spacing={10}>
            <VStack alignment="leading" spacing={10} modifiers={[contentShape(shapes.rectangle()),
              onTapGesture(() => { if (!item.busy) controller.candidateAction(item.raw); }),
              onLongPressGesture(() => { if (!item.busy) controller.toggleSelection(item.raw); })]}>
              <HStack spacing={12}><Text modifiers={[font({ textStyle: 'headline' })]}>{item.selected ? '✓' : `#${item.rank}`}</Text>
                <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                  <Text modifiers={[font({ textStyle: 'headline' })]}>{item.title}</Text>{!!item.subtitle && <Text modifiers={[secondary]}>{item.subtitle}</Text>}
                </VStack><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), secondary]}>{item.matchLabel}</Text>
              </HStack>
              {item.details.map((detail, index) => <Text key={index} modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{detail}</Text>)}
              {!!item.groupApparatus && <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{item.groupApparatus}</Text>}
            </VStack>
            <Button label={item.actionLabel} systemImage={item.selectionMode ? item.selected ? 'checkmark' : 'square' : 'link'}
              onPress={() => controller.candidateAction(item.raw)} modifiers={[buttonStyle('borderedProminent'), frame({ minHeight: 48, maxWidth: Infinity }), disabled(item.busy)]} />
            {item.busy && <ProgressView />}
          </VStack></Section>)}
          {!!h.assignments.length && <Section title={t('production.assignment.connected_title')}>{h.assignments.map(item => <HStack key={item.key} spacing={12}>
            <Image systemName="checkmark.circle" size={22} color={PlatformColor('systemGreen')} /><VStack alignment="leading" spacing={4}>
              <Text>{item.title}</Text>{!!item.subtitle && <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{item.subtitle}</Text>}
            </VStack>
          </HStack>)}</Section>}
        </>}
    </List>
    {!!state.selectedKeys.size && <Button label={t('production.assignment.link_count', { count: state.selectedKeys.size })} systemImage="link"
      onPress={() => { void controller.assignSelected(); }} modifiers={[buttonStyle('borderedProminent'), frame({ minHeight: 48, maxWidth: Infinity }),
        padding({ horizontal: 16, vertical: 12 }), disabled(state.bulkAssigning)]} />}
  </VStack></Host>;
}
