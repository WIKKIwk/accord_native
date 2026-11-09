import { Button, CircularProgressIndicator, Host, IconButton, OutlinedButton, OutlinedTextField, RNHostView, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreparationRow, PreparationText, usePreparationText } from '../preparation/PreparationUI';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { trimNotificationText } from '../shared/notification/notificationDetailModel';
import { supplierConfirmationRows, supplierInitialQuantity, supplierQuantity } from './supplierScreenModel';
import type { SupplierConfirmProps, SupplierPickerProps, SupplierQtyProps, SupplierSuccessProps } from './supplierCreateTypes';
import { useSupplierConfirm, useSupplierPicker } from './useSupplierCreate';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

function Page({ title, onBack, children, footer, blocked = false }: { title: string; onBack?: () => void;
  children: ReactNode; footer?: ReactNode; blocked?: boolean }) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), t = usePreparationText();
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={title} navigation={onBack ? { icon: 'back', label: t('Orqaga'), onPress: () => { if (!blocked) onBack(); } } : undefined} />
    {children}<View pointerEvents={blocked ? 'none' : 'auto'}>{footer}</View>
  </View>;
}

// @v2 SupplierItemPickerScreen
export function SupplierItemPickerScreen(props: SupplierPickerProps) {
  const { controller, state, items } = useSupplierPicker(props), t = usePreparationText(), input = useNativeState('');
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return <Page title="Mahsulot tanlash" onBack={props.onBack} footer={props.footer}>
    <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}><Host matchContents={{ vertical: true }}>
      <OutlinedTextField value={input} singleLine onValueChange={value => controller.setQuery(value)} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Placeholder><Text>{t('Nom bo‘yicha qidiring')}</Text></OutlinedTextField.Placeholder>
        {!!trimNotificationText(state.query) && <OutlinedTextField.TrailingIcon><IconButton
          modifiers={[semantics({ contentDescription: localizedGetter('clearTitle', locale) })]} onClick={() => { input.set(''); controller.setQuery(''); }}>
          <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={24} /></RNHostView>
        </IconButton></OutlinedTextField.TrailingIcon>}
      </OutlinedTextField>
    </Host></View>
    {state.loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
      : <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24, gap: 2 }}
        refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void controller.reload(); }} />}>
        {state.error != null ? <><PreparationText>{localizedGetter('serverDisconnectedRetry', locale)}</PreparationText>
          <Host matchContents={{ vertical: true }}><TextButton onClick={() => { void controller.reload(); }}><Text>{localizedGetter('retry', locale)}</Text></TextButton></Host></>
          : items.length === 0 ? <PreparationText>{t(trimNotificationText(state.query)
            ? 'Mahsulot topilmadi.' : 'Bu supplierga item biriktirilmagan.')}</PreparationText>
            : items.map((item, index) => <PreparationRow key={`${item.code}:${index}`} title={item.name || item.code} onPress={() => props.onChoose(item)} />)}
      </ScrollView>}
  </Page>;
}

// @v2 SupplierQtyScreen
export function SupplierQtyScreen(props: SupplierQtyProps) {
  const t = usePreparationText(), initial = supplierInitialQuantity(props.initialQty), input = useNativeState(initial);
  const [quantity, setQuantity] = useState(initial);
  return <Page title="Miqdor" onBack={props.onBack} footer={props.footer}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 18 }}>
      <PreparationText title>{props.item.name}</PreparationText>
      <Host matchContents={{ vertical: true }}><OutlinedTextField value={input} singleLine onValueChange={setQuantity}
        keyboardOptions={{ keyboardType: 'decimal' }} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Suffix><Text>{props.item.uom}</Text></OutlinedTextField.Suffix>
      </OutlinedTextField></Host>
      <Host matchContents={{ vertical: true }}><Button modifiers={[fillMaxWidth(), testID('supplier-quantity-continue')]}
        onClick={() => { const qty = supplierQuantity(quantity); if (qty !== null) props.onContinue(qty); }}><Text>{t('Davom etish')}</Text></Button></Host>
    </ScrollView>
  </Page>;
}

// @v2 SupplierConfirmScreen
export function SupplierConfirmScreen(props: SupplierConfirmProps) {
  const { controller, submitting, notice } = useSupplierConfirm(props), t = usePreparationText();
  return <Page title="Tasdiqlash" onBack={props.onBack} footer={props.footer} blocked={submitting}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}><PreparationText title>{props.item.name}</PreparationText>
      <PreparationText>{props.item.code}</PreparationText>
      {supplierConfirmationRows(props.item, props.qty).map(row => <PreparationRow key={row.label} title={row.label} subtitle={row.value} />)}
      <Host matchContents={{ vertical: true }}><Button enabled={!submitting} modifiers={[fillMaxWidth(), testID('supplier-confirm-submit')]}
        onClick={() => { void controller.submit(); }}>{submitting ? <CircularProgressIndicator strokeWidth={2.2} modifiers={[size(18, 18)]} />
          : <Text>{t('Ha, jo‘natishni saqlash')}</Text>}</Button></Host>
      <Host matchContents={{ vertical: true }}><OutlinedButton enabled={!submitting} modifiers={[fillMaxWidth()]} onClick={props.onBack}>
        <Text>{t('Orqaga qaytish')}</Text></OutlinedButton></Host>
    </ScrollView><PreparationNotice message={t(notice)} />
  </Page>;
}

// @v2 SupplierSuccessScreen
export function SupplierSuccessScreen(props: SupplierSuccessProps) {
  const t = usePreparationText(), record = props.record;
  return <Page title="Saqlandi" onBack={props.onBack} footer={props.footer}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 18 }}>
      <SymbolView name={{ android: 'check_circle' }} size={72} /><PreparationText title>{record.id}</PreparationText>
      <PreparationText>{`${record.item_code} • ${record.sent_qty.toFixed(2)} ${record.uom}`}</PreparationText>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Button modifiers={[fillMaxWidth(), testID('supplier-success-home')]}
        onClick={props.onHome}><Text>{t('Home ga qaytish')}</Text></Button></Host>
    </ScrollView>
  </Page>;
}
