import { Button, HStack, Image, ProgressView, Section, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled, keyboardType } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { PlatformColor, View } from 'react-native';
import { PreparationList, usePreparationText } from '../preparation/PreparationUI';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { trimNotificationText } from '../shared/notification/notificationDetailModel';
import { supplierConfirmationRows, supplierInitialQuantity, supplierQuantity } from './supplierScreenModel';
import type { SupplierConfirmProps, SupplierPickerProps, SupplierQtyProps, SupplierSuccessProps } from './supplierCreateTypes';
import { useSupplierConfirm, useSupplierPicker } from './useSupplierCreate';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

function Header({ title, onBack, blocked = false }: { title: string; onBack: () => void; blocked?: boolean }) {
  const t = usePreparationText();
  return <Stack.Screen options={{ title, headerLeft: () => <RoleHeaderButton icon="back" label={t('Orqaga')}
    onPress={() => { if (!blocked) onBack(); }} tintColor={PlatformColor('label')} /> }} />;
}

// @v2 SupplierItemPickerScreen
export function SupplierItemPickerScreen(props: SupplierPickerProps) {
  const { controller, state, items } = useSupplierPicker(props), t = usePreparationText();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), input = useNativeState('');
  return <View style={{ flex: 1 }}><Header title="Mahsulot tanlash" onBack={props.onBack} />
    <PreparationList refresh={() => controller.reload()}>
      <Section><HStack><TextField text={input} placeholder={t('Nom bo‘yicha qidiring')} onTextChange={value => controller.setQuery(value)} />
        {!!trimNotificationText(state.query) && <Button label="" systemImage="xmark.circle.fill"
          modifiers={[accessibilityLabel(localizedGetter('clearTitle', locale))]}
          onPress={() => { input.set(''); controller.setQuery(''); }} />}</HStack></Section>
      {state.loading ? <ProgressView /> : state.error != null ? <Section>
        <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <Button label={localizedGetter('retry', locale)} onPress={() => { void controller.reload(); }} />
      </Section> : items.length === 0 ? <Section><Text>{t(trimNotificationText(state.query)
        ? 'Mahsulot topilmadi.' : 'Bu supplierga item biriktirilmagan.')}</Text></Section>
        : <Section>{items.map((item, index) => <Button key={`${item.code}:${index}`} label={item.name || item.code}
          onPress={() => props.onChoose(item)} />)}</Section>}
    </PreparationList>{props.footer}</View>;
}

// @v2 SupplierQtyScreen
export function SupplierQtyScreen(props: SupplierQtyProps) {
  const t = usePreparationText(), initial = supplierInitialQuantity(props.initialQty), input = useNativeState(initial);
  const [quantity, setQuantity] = useState(initial);
  return <View style={{ flex: 1 }}><Header title="Miqdor" onBack={props.onBack} />
    <PreparationList><Section><Text>{props.item.name}</Text>
      <HStack><TextField text={input} onTextChange={setQuantity} modifiers={[keyboardType('decimal-pad')]} /><Spacer /><Text>{props.item.uom}</Text></HStack>
      <Button label={t('Davom etish')} onPress={() => { const qty = supplierQuantity(quantity); if (qty !== null) props.onContinue(qty); }} />
    </Section></PreparationList>{props.footer}</View>;
}

// @v2 SupplierConfirmScreen
export function SupplierConfirmScreen(props: SupplierConfirmProps) {
  const { controller, submitting, notice } = useSupplierConfirm(props), t = usePreparationText();
  return <View style={{ flex: 1 }}><Header title="Tasdiqlash" onBack={props.onBack} blocked={submitting} />
    <PreparationList><Section><Text>{props.item.name}</Text><Text>{props.item.code}</Text></Section>
      <Section>{supplierConfirmationRows(props.item, props.qty).map(row => <HStack key={row.label}>
        <Text>{row.label}</Text><Spacer /><Text>{row.value}</Text></HStack>)}</Section>
      <Section><Button modifiers={[disabled(submitting)]} onPress={() => { void controller.submit(); }}>
        {submitting ? <ProgressView /> : <Text>{t('Ha, jo‘natishni saqlash')}</Text>}
      </Button><Button label={t('Orqaga qaytish')} modifiers={[disabled(submitting)]} onPress={props.onBack} /></Section>
    </PreparationList><View pointerEvents={submitting ? 'none' : 'auto'}>{props.footer}</View>
    <PreparationNotice message={t(notice)} /></View>;
}

// @v2 SupplierSuccessScreen
export function SupplierSuccessScreen(props: SupplierSuccessProps) {
  const t = usePreparationText(), record = props.record;
  return <View style={{ flex: 1 }}><Header title="Saqlandi" onBack={props.onBack} />
    <PreparationList><Section><VStack spacing={16}><Image systemName="checkmark.circle.fill" size={72} />
      <Text>{record.id}</Text><Text>{`${record.item_code} • ${record.sent_qty.toFixed(2)} ${record.uom}`}</Text>
    </VStack></Section><Section><Button label={t('Home ga qaytish')} onPress={props.onHome} /></Section></PreparationList>
    {props.footer}</View>;
}
