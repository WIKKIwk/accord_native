import { Button, Host, HStack, List, Picker, ProgressView, RNHostView, Spacer, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityElement, buttonStyle, contentShape, disabled, font, frame, listStyle, onLongPressGesture, onTapGesture, padding, pickerStyle, refreshable, shapes, tag, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import type { Session } from '../auth';
import type { MovementTab } from '../shared/inventoryMovementModel';
import { WorkerAlert } from './WorkerAlert';
import { WorkerInventoryScanner } from './WorkerInventoryScanner';
import { WorkerInventorySheet } from './WorkerInventorySheet';
import { useWorkerInventorySurface } from './useWorkerInventorySurface';
import { useWorkerInventoryKey } from './useWorkerInventory';

/** @v2 InventoryMovementsScreen */
export function WorkerInventoryScreen(props: { session: Session; onBack: () => void }) { const key = useWorkerInventoryKey(props.session); return <InventoryOwner key={key} {...props} />; }
function InventoryOwner({ session, onBack }: { session: Session; onBack: () => void }) {
  const surface = useWorkerInventorySurface(session), { state, owner, t } = surface;
  const tabs = [{ id: 'assets', name: 'Mahsulotlar' }, { id: 'incoming', name: 'Kiruvchi' }, { id: 'outgoing', name: 'Chiquvchi' }];
  if (!surface.valid) return <Host style={{ flex: 1 }}><Text>{t('Inventar ruxsatlari o‘zgardi. Hisobni yangilang.')}</Text></Host>;
  return <View style={{ flex: 1 }}>
    <Stack.Screen options={{ headerShown: true, title: t('Joylashtirish va transfer') }} />
    <Host style={{ flex: 1 }}>
      <VStack spacing={0}>
        {state.selected.size ? <HStack modifiers={[padding({ all: 12 })]}>
          <Button label={t('Tanlashni bekor qilish')} onPress={() => owner.clearSelection()} />
          <Text>{t(`${state.selected.size} ta tanlandi`)}</Text><Spacer />
          <Button label={t('State’ga ko‘chirish')} modifiers={[disabled(state.busy.has('relocate-batch'))]} onPress={surface.relocateSelected} />
        </HStack> : <TextField placeholder={t('Mahsulot, kod yoki QR qidirish')} onTextChange={value => owner.search(value)}
          modifiers={[textFieldStyle('roundedBorder'), padding({ all: 12 })]} />}
        <Picker label="" selection={state.tab} onSelectionChange={value => owner.setTab(value as MovementTab)} modifiers={[pickerStyle('segmented'), padding({ horizontal: 12 })]}>
          {tabs.map(tab => <Text key={tab.id} modifiers={[tag(tab.id)]}>{t(tab.name)}</Text>)}
        </Picker>
        <List modifiers={[listStyle('plain'), refreshable(() => owner.refresh())]}>
          <Picker label={t('Ombor')} selection={state.warehouse} onSelectionChange={value => {
            if (typeof value === 'string' && owner.warehouses.some(row => row.warehouse_id === value)) owner.selectWarehouse(value);
          }} modifiers={[pickerStyle('menu'), disabled(!owner.warehouses.length)]}>
            {owner.warehouses.length ? owner.warehouses.map(row => <Text key={row.warehouse_id} modifiers={[tag(row.warehouse_id)]}>{row.name}</Text>)
              : <Text modifiers={[tag(''), disabled(true)]}>{t('Tanlanmagan')}</Text>}
          </Picker>
          {state.scanning ? <RNHostView matchContents><WorkerInventoryScanner surface={surface} /></RNHostView> : null}
          {surface.loading ? <ProgressView /> : null}
          {!!state.error && <VStack><Text>{t(state.error)}</Text><Button label={t('Qayta urinish')} onPress={() => { void owner.refresh(); }} /></VStack>}
          {state.scanning || state.tab === 'assets' ? surface.rows.map(row => <HStack key={row.key} spacing={12} modifiers={[
            frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()), onTapGesture(row.open),
            ...(row.selectable ? [onLongPressGesture(row.hold)] : []), accessibilityElement('combine'), accessibilityAddTraits(['isButton']), padding({ vertical: 8 }),
          ]}>
            <VStack alignment="leading" spacing={3}><Text modifiers={[font({ textStyle: 'headline' })]}>{row.title}</Text><Text>{row.supporting}</Text></VStack>
            <Spacer />{row.selected ? <Text>✓</Text> : null}
          </HStack>) : surface.transfers.map(row => <Button key={row.key} onPress={row.open} modifiers={[buttonStyle('plain')]}>
            <VStack alignment="leading"><Text>{row.title}</Text><Text>{t(row.status)}</Text><Text>{row.supporting}</Text></VStack>
          </Button>)}
          {!surface.loading && !state.error && !(state.scanning || state.tab === 'assets' ? surface.rows.length : surface.transfers.length) ? <Text>{t(surface.empty)}</Text> : null}
          {!!state.notice && <Text>{t(state.notice)}</Text>}
        </List>
        {!state.scanning ? <Button label={t('QR orqali izlash')} onPress={() => owner.toggleScanning()} modifiers={[padding({ all: 12 })]} /> : null}
        <Button label={t('Orqaga')} onPress={onBack} />
      </VStack>
    </Host>
    <WorkerInventorySheet session={session} surface={surface} />
    <WorkerAlert alert={surface.alert} onDismiss={surface.dismissAlert} />
  </View>;
}
