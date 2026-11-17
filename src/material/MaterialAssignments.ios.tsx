import { Alert, Button, Host, HStack, Image, Picker, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, foregroundStyle, frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PlatformColor, View, useWindowDimensions } from 'react-native';
import { RawSplitScanner } from '../homashyo/RawSplitScanner';
import { useNativeSheet } from '../nativeSheet';
import { PreparationList } from '../preparation/PreparationUI';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent.ios';
import { useMaterialAssignments } from './useMaterialAssignments';
import { useMaterialAssignmentPicker } from './useMaterialAssignmentPicker';
import { MaterialAssignmentNotice } from './MaterialAssignmentNotice';

type Model = ReturnType<typeof useMaterialAssignments>;
type Candidate = Model['state']['candidates'][number];
type Assignment = Model['state']['assignments'][number];
type Dialog = { title: string; message: string; options: { label: string; value: string | null; role?: 'cancel' | 'destructive' }[] };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const action = [buttonStyle('borderedProminent'), frame({ minHeight: 48, maxWidth: Infinity })];

function Info({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return <HStack alignment="top" spacing={10}>
    <Text modifiers={[secondary, frame({ width: 104, alignment: 'leading' })]}>{label}</Text>
    <Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{value.trim()}</Text>
  </HStack>;
}

/** @v2 _ManualMaterialSheetSurface */
/** @v2 _ManualCandidateDetailsSheet */
/** @v2 _ManualAssignmentDetailsSheet */
function MaterialDetails({ title, subtitle, symbol, rows, label, unavailable, destructive, select }: {
  title: string; subtitle: string; symbol: SFSymbol; rows: { label: string; value: string }[];
  label: string; unavailable?: boolean; destructive?: boolean; select(): void;
}) {
  return <View style={{ padding: 20 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={18} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <HStack alignment="top" spacing={14}><Image systemName={symbol} size={30} color={PlatformColor('systemBlue')} />
        <VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{title}</Text>
          {!!subtitle && subtitle !== title && <Text modifiers={[secondary]}>{subtitle}</Text>}
        </VStack>
      </HStack>
      <VStack alignment="leading" spacing={10}>{rows.map((row, index) => <Info key={`${row.label}:${index}`} {...row} />)}</VStack>
      <Button label={label} systemImage="link" role={destructive ? 'destructive' : undefined}
        modifiers={[...action, disabled(!!unavailable)]} onPress={select} />
    </VStack>
  </Host></View>;
}

function OrderPicker({ orders, orderLabel, title, hint, emptyLabel, closeLabel, close, select }: { orders: Model['state']['orders']; orderLabel: Model['orderLabel'];
  title: string; hint: string; emptyLabel: string; closeLabel: string; close(): void; select(id: string): void;
}) {
  const picker = useMaterialAssignmentPicker(orders, orderLabel);
  return <PickerSheetContent title={title} hint={hint} query={picker.input} closeLabel={closeLabel} emptyLabel={emptyLabel}
    onClose={close} onSearch={picker.setInput} hasMore={picker.hasMore} onLoadMore={picker.loadMore}
    items={picker.items.map(order => ({ key: order.map.id, title: orderLabel(order), subtitle: order.map.id.trim(), select: () => select(order.map.id) }))} />;
}

/** @v2 AdminRawMaterialAssignmentScreen */
/** @v2 AdminRawMaterialAssignmentPanel */
/** @v2 _AssignmentTile */
/** @v2 _ScannedRawMaterialCard */
/** @v2 _ScannedRawMaterialAssignmentSection */
/** @v2 _AssignmentEditor */
/** @v2 _AssignmentOrderPicker */
/** @v2 _ManualCandidateListRow */
/** @v2 _ManualAssignmentListRow */
/** @v2 _MaterialGroupScopeMissingState */
export function MaterialAssignments() {
  const model = useMaterialAssignments(), { controller, state, t } = model;
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot), l = (key: string) => localizedGetter(key, locale);
  const details = useNativeSheet(), picker = useNativeSheet();
  const [scanning, setScanning] = useState(false), [dialog, setDialog] = useState<Dialog | null>(null);
  const dialogResult = useRef<((value: string | null) => void) | null>(null), sheetResult = useRef<((value: boolean) => void) | null>(null);
  const { width, height } = useWindowDimensions(), current = controller.isCurrent();
  useEffect(() => {
    if (current) return;
    dialogResult.current?.(null); dialogResult.current = null;
    sheetResult.current?.(false); sheetResult.current = null; details.close(); picker.close();
  }, [current, details, picker]);
  useEffect(() => () => {
    dialogResult.current?.(null); sheetResult.current?.(false); details.close(); picker.close();
  }, [controller, details, picker]);
  if (!current && model.groupScopeReady) return null;
  const finishDialog = (value: string | null) => {
    const finish = dialogResult.current; dialogResult.current = null; setDialog(null);
    finish?.(controller.isCurrent() ? value : null);
  };
  const requestDialog = (next: Dialog) => new Promise<string | null>(resolve => {
    if (!controller.isCurrent() || dialogResult.current) { resolve(null); return; }
    dialogResult.current = resolve; setDialog(next);
  });
  const choose = (options: readonly string[]) => requestDialog({ title: t('raw_material.choose_apparatus'),
    message: t('raw_material.choose_apparatus_message'), options: [
      ...options.map(id => ({ label: model.apparatusLabel(id), value: id })),
      { label: t('action.cancel'), value: null, role: 'cancel' },
    ] });
  const confirmUnlink = (row: Assignment) => async () => await requestDialog({ title: t('raw_material.unlink_title'),
    message: model.unlinkConfirmationMessage(row), options: [
      { label: t('action.cancel'), value: null, role: 'cancel' },
      { label: t('raw_material.unassign'), value: 'confirm', role: 'destructive' },
    ] }) === 'confirm';
  const presentDetails = (content: (select: () => void) => React.ReactNode) => new Promise<boolean>(resolve => {
    if (!controller.isCurrent() || details.isOpen() || sheetResult.current) { resolve(false); return; }
    let selected = false;
    sheetResult.current = resolve;
    details.open(content(() => { if (!controller.isCurrent() || selected) return; selected = true; details.close(); }), {
      dismissible: true, compact: true, fitContent: true,
      onDismiss: () => { const finish = sheetResult.current; sheetResult.current = null; finish?.(selected && controller.isCurrent()); },
    });
  });
  const candidateRows = (row: Candidate) => [
    { label: t('raw_material.qr'), value: row.barcode }, { label: t('raw_material.warehouse'), value: row.warehouse },
    { label: t('raw_material.group'), value: row.item_group }, { label: t('raw_material.quantity'), value: model.formatQty(row.qty, row.uom) },
    { label: t('raw_material.apparatus'), value: row.apparatus_options.map(model.apparatusLabel).sort().join(', ') },
  ];
  const assignmentRows = (row: Assignment) => [
    { label: t('raw_material.qr'), value: row.barcode }, { label: t('raw_material.order_label'), value: row.order_id },
    { label: t('raw_material.apparatus'), value: model.apparatusLabel(row.apparatus) },
    { label: t('raw_material.warehouse'), value: row.stock_warehouse }, { label: t('raw_material.group'), value: row.item_group },
    ...(row.stock_qty > 0 ? [{ label: t('raw_material.quantity'), value: model.formatQty(row.stock_qty, row.stock_uom) }] : []),
    { label: t('raw_material.status'), value: model.statusLabel(row) },
  ];
  const expandedAssignmentRows = (row: Assignment) => [
    { label: t('raw_material.order_label'), value: row.order_id }, { label: t('raw_material.qr'), value: row.barcode },
    { label: t('raw_material.apparatus'), value: model.apparatusLabel(row.apparatus) },
    { label: t('raw_material.warehouse'), value: row.stock_warehouse }, { label: t('raw_material.item_code'), value: row.item_code },
    { label: t('raw_material.item_name'), value: row.item_name }, { label: t('raw_material.group'), value: row.item_group },
    { label: t('raw_material.status'), value: model.statusLabel(row) }, { label: t('raw_material.reserved_order'), value: row.reserved_order_id },
    { label: t('raw_material.assigned_by'), value: model.assignmentAssignee(row) },
    { label: t('raw_material.time'), value: model.formatAssignmentTimestamp(row.assigned_at) },
  ];
  const openCandidate = (row: Candidate) => { void controller.assignCandidate(row, () => presentDetails(select => <MaterialDetails
    title={row.item_name.trim() ? row.item_name : row.item_code} subtitle={row.item_code} symbol="shippingbox" rows={candidateRows(row)}
    label={t('raw_material.assign_to_order')} select={select} />), choose); };
  const openAssignment = async (row: Assignment) => {
    const canUnlink = model.canUnlink(row);
    if (await presentDetails(select => <MaterialDetails title={row.item_name.trim() ? row.item_name : row.item_code} subtitle={row.item_code} symbol="link"
      rows={assignmentRows(row)} destructive unavailable={!canUnlink} label={t(canUnlink ? 'raw_material.unassign' : 'raw_material.unassign_unavailable')}
      select={select} />)) await controller.unlink(row, confirmUnlink(row));
  };
  const selectOrder = () => {
    if (!controller.isCurrent() || picker.isOpen()) return;
    let selected: string | null = null;
    picker.open(<OrderPicker orders={state.orders} orderLabel={model.orderLabel}
      title={t('raw_material.order_select')} hint={t('raw_material.order_search')} emptyLabel={l('noRecordsYet')} closeLabel={l('closeAction')}
      close={picker.close} select={id => { selected = id; picker.close(); }} />, { dismissible: true,
      onDismiss: () => { if (selected !== null && controller.isCurrent()) controller.selectOrder(selected); } });
  };
  const selectedAssignment = state.lookup?.assignment;
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('raw_material.assign_title') }} />
    <PreparationList refresh={() => controller.refresh()}>
      {!model.groupScopeReady ? <Section><Text>{t('raw_material.group_missing')}</Text><Text>{t('raw_material.group_missing_message')}</Text></Section>
        : state.loading ? <ProgressView /> : state.error ? <Section><Text>{l('serverDisconnectedRetry')}</Text>
          <Button label={l('retry')} onPress={() => { void controller.refresh(); }} modifiers={action} /></Section> : <>
          <Section><Picker selection={state.tab} onSelectionChange={value => { if (value === 'manual' || value === 'qr') controller.setTab(value); }}
            modifiers={[pickerStyle('segmented')]}><Text modifiers={[tag('manual')]}>Ro‘yxatdan</Text><Text modifiers={[tag('qr')]}>QR orqali</Text></Picker>
          </Section>
          <Section><Button onPress={selectOrder} modifiers={[frame({ minHeight: 44 }), disabled(state.saving || !!state.assigningBarcode || (state.tab === 'qr' && !!selectedAssignment) || !state.orders.length)]}>
            <HStack><Text>{t('raw_material.order_label')}</Text><Text modifiers={[frame({ maxWidth: Infinity, alignment: 'trailing' })]}>
              {model.selectedOrderLabel || t(state.orders.length ? 'raw_material.select' : 'raw_material.not_found')}</Text><Image systemName="chevron.down" size={16} /></HStack>
          </Button>
            {state.tab === 'manual' && !!state.apparatusOptions.length && <Picker label={t('raw_material.apparatus')} selection={state.selectedApparatus}
              onSelectionChange={value => { if (typeof value === 'string') controller.selectApparatus(value); }}
              modifiers={[pickerStyle('menu'), disabled(state.saving || !!state.assigningBarcode || state.candidatesLoading)]}>
              {state.apparatusOptions.map(id => <Text key={id} modifiers={[tag(id)]}>{model.apparatusLabel(id)}</Text>)}
            </Picker>}
          </Section>
          {state.tab === 'manual' ? <>
            <Section title={t('raw_material.unlinked_section')}>
              {state.candidatesLoading ? <ProgressView /> : state.candidatesError ? <><Text>{t('raw_material.candidates_failed')}</Text>
                <Button label={t('action.retry')} onPress={() => { void controller.retryCandidates(); }} /></>
                : !state.candidates.length ? <Text>{t('raw_material.candidates_empty')}</Text> : state.candidates.map(row => <Button key={row.barcode}
                  onPress={() => openCandidate(row)} modifiers={[disabled(state.assigningBarcode.trim().toUpperCase() === row.barcode.trim().toUpperCase()), frame({ minHeight: 48 })]}>
                  <HStack spacing={12}><Image systemName="shippingbox" size={24} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                    <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{row.item_name.trim() ? row.item_name : row.item_code}</Text>
                    <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{[row.barcode.trim(), model.formatQty(row.qty, row.uom), row.warehouse.trim()].filter(Boolean).join(' • ')}</Text>
                  </VStack>{state.assigningBarcode.trim().toUpperCase() === row.barcode.trim().toUpperCase() ? <ProgressView /> : <Image systemName="link.badge.plus" size={22} />}</HStack>
                </Button>)}
            </Section>
            <Section title={t('raw_material.linked_section')}>
              {!model.visibleAssignments.length ? <Text>{t('raw_material.order_empty')}</Text> : model.visibleAssignments.map(row => <Button key={model.assignmentKey(row)}
                onPress={() => { void openAssignment(row); }} modifiers={[disabled(state.unlinkingKey === model.assignmentKey(row)), frame({ minHeight: 48 })]}>
                <HStack spacing={12}><Image systemName="link" size={24} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                  <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{row.item_name.trim() ? row.item_name : row.item_code}</Text>
                  <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{[row.barcode.trim(), row.stock_qty > 0 ? model.formatQty(row.stock_qty, row.stock_uom) : '', row.stock_warehouse.trim()].filter(Boolean).join(' • ')}</Text>
                </VStack>{state.unlinkingKey === model.assignmentKey(row) && <ProgressView />}</HStack>
              </Button>)}
            </Section>
          </> : <>
            <Section><Button label={t('raw_material.qr_scan')} systemImage="qrcode.viewfinder" onPress={() => setScanning(true)} modifiers={[...action, disabled(state.saving)]} /></Section>
            {!!state.barcode && <Section title={t('raw_material.material_info')}>
              {state.scanLoading && <ProgressView />}<Info label={t('raw_material.qr')} value={state.barcode} />
              {state.lookup && <>
                <Info label={t('raw_material.warehouse')} value={state.lookup.warehouse} /><Info label={t('raw_material.type')} value={state.lookup.item_group} />
                <Info label={t('raw_material.item_name')} value={state.lookup.item_name} /><Info label={t('raw_material.quantity')} value={model.formatQty(state.lookup.qty, state.lookup.uom)} />
                <Info label={t('raw_material.item_code')} value={state.lookup.item_code} />
                {!!model.diagnosticMessage && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{model.diagnosticMessage}</Text>}
                {selectedAssignment ? <>
                  <Text>{t('raw_material.current_order')}</Text><Text modifiers={[font({ textStyle: 'headline' })]}>{model.scannedOrderLabel}</Text>
                  {!!model.scannedStatusLabel && <Text>{model.scannedStatusLabel}</Text>}
                  {!!model.scannedLockMessage && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{model.scannedLockMessage}</Text>}
                  <Button label={t(model.canUnlink(selectedAssignment, 'scan') ? 'raw_material.unassign_from_order' : 'raw_material.unassign_unavailable')}
                    systemImage={model.canUnlink(selectedAssignment, 'scan') ? 'link' : 'lock'} role="destructive"
                    modifiers={[buttonStyle('bordered'), frame({ minHeight: 48, maxWidth: Infinity }), disabled(!model.canUnlink(selectedAssignment, 'scan') || state.unlinkingKey === model.assignmentKey(selectedAssignment))]}
                    onPress={() => { void controller.unlink(selectedAssignment, confirmUnlink(selectedAssignment)); }} />
                </> : <Text>{t('raw_material.unassigned_order')}</Text>}
              </>}
              {!!state.scanError && <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{state.scanError}</Text>}
            </Section>}
            <Section><Button label={t('raw_material.assign')} systemImage="link" modifiers={[...action, disabled(!model.canSave)]}
              onPress={() => { void controller.save(choose); }} />{state.saving && <ProgressView />}</Section>
            <Section>{!state.assignments.length ? <Text>{t('raw_material.linked_empty')}</Text> : state.assignments.map(row => {
              const key = model.assignmentKey(row), expanded = state.expandedKey === key;
              return <VStack key={key} alignment="leading" spacing={10}>
                <Button onPress={() => controller.expand(expanded ? null : key)} modifiers={[frame({ minHeight: 48 })]}>
                  <HStack spacing={12}><Image systemName="qrcode" size={24} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                    <Text modifiers={[font({ textStyle: 'headline' })]}>{row.order_id.trim()}</Text><Text>{row.barcode.trim()}</Text>
                    <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{[model.apparatusLabel(row.apparatus), row.item_name, row.item_group].filter(value => value.trim()).join(' · ')}</Text>
                  </VStack><Image systemName={expanded ? 'chevron.up' : 'chevron.down'} size={18} /></HStack>
                </Button>
                {expanded && <>{expandedAssignmentRows(row).map((entry, index) => <Info key={index} {...entry} />)}
                  {model.canUnlink(row) && <Button label={t('raw_material.unassign')} systemImage="link" role="destructive"
                    onPress={() => { void controller.unlink(row, confirmUnlink(row)); }} modifiers={[buttonStyle('bordered'), frame({ minHeight: 48 }), disabled(state.unlinkingKey === key)]} />}
                </>}
              </VStack>;
            })}</Section>
          </>}
        </>}
    </PreparationList>
    <MaterialAssignmentNotice message={state.notice} tone={state.noticeTone} />
    <RawSplitScanner visible={current && scanning} active={current} isCurrent={controller.isCurrent} onClose={() => setScanning(false)}
      onComplete={barcode => { setScanning(false); void controller.scan(barcode); return true; }} />
    {current && dialog && <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
      <Alert title={dialog.title} isPresented onIsPresentedChange={shown => { if (!shown) finishDialog(null); }}>
        <Alert.Trigger><Text> </Text></Alert.Trigger><Alert.Message><Text>{dialog.message}</Text></Alert.Message>
        <Alert.Actions>{dialog.options.map((option, index) => <Button key={index} label={option.label} role={option.role}
          onPress={() => finishDialog(option.value)} />)}</Alert.Actions>
      </Alert>
    </Host>}
  </View>;
}
