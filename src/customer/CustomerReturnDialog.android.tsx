import { AlertDialog, Host, OutlinedTextField, RNHostView, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, Text as RNText, useWindowDimensions, View } from 'react-native';
import { useCustomerText } from './CustomerContext';
import { customerReturnInput } from './customerLogic';
import { customerReturnTitleKey, type CustomerReturnDialogProps, type CustomerReturnKind } from './customerDeliveryView';
import { customerLayoutDirection } from './customerPresentation';

export function CustomerReturnDialog(props: CustomerReturnDialogProps) {
  if (!props.kind) return null;
  return <ReturnDialogForm key={props.kind} {...props} kind={props.kind} />;
}
function ReturnDialogForm({ kind, sentQty, uom, onCancel, onConfirm }: Omit<CustomerReturnDialogProps, 'kind'> & { kind: CustomerReturnKind }) {
  const { locale, text } = useCustomerText(), { width, height } = useWindowDimensions(), colors = useMaterialColors();
  const quantityState = useNativeState(''), commentState = useNativeState('');
  const [quantity, setQuantity] = useState(''), [comment, setComment] = useState(''), [reason, setReason] = useState<string | null>(null);
  const reasons = ['rejectReasonDefective', 'rejectReasonWrongItem', 'rejectReasonQtyMismatch'].map(text);
  const input = customerReturnInput({ sentQty, rawQty: quantity, selectedReason: reason, comment,
    requireQtyEntry: kind !== 'reject', allowFullReturn: kind !== 'partial' });
  const direction = customerLayoutDirection(locale);
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none" layoutDirection={direction}>
    <AlertDialog onDismissRequest={onCancel} properties={{ dismissOnBackPress: true, dismissOnClickOutside: true }}>
      <AlertDialog.Title><Text>{text(customerReturnTitleKey(kind))}</Text></AlertDialog.Title>
      <AlertDialog.Text><RNHostView matchContents><View style={{ width: Math.max(1, Math.min(width - 112, 480)),
        direction: direction === 'rightToLeft' ? 'rtl' : 'ltr' }}>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.55 }} contentContainerStyle={{ gap: 12 }}>
          {kind !== 'reject' ? <Host matchContents={{ vertical: true }} style={{ width: '100%', marginBottom: 4 }} layoutDirection={direction}>
            <OutlinedTextField value={quantityState} onValueChange={setQuantity} singleLine keyboardOptions={{ keyboardType: 'decimal' }} modifiers={[fillMaxWidth()]}>
              <OutlinedTextField.Label><Text>{text(kind === 'partial' ? 'returningQtyLabel' : 'returnedQtyLabel')}</Text></OutlinedTextField.Label>
              <OutlinedTextField.Placeholder><Text>{`${sentQty.toFixed(2)} ${uom}`}</Text></OutlinedTextField.Placeholder>
              <OutlinedTextField.Suffix><Text>{uom}</Text></OutlinedTextField.Suffix>
            </OutlinedTextField></Host> : null}
          <View testID="customer-reason-group">
            <Host matchContents={{ vertical: true }} style={{ marginBottom: 8 }} layoutDirection={direction}>
              <Text style={{ typography: 'titleMedium', fontSize: 16, fontWeight: '500' }}>{text('reasonLabel')}</Text>
            </Host>
            {reasons.map((item, index) => <Pressable key={item} testID={`customer-reason-${index}`} accessibilityRole="radio"
              accessibilityState={{ checked: reason === item }} android_ripple={{}} onPress={() => setReason(reason === item ? null : item)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderRadius: 16 }}>
              <SymbolView name={{ android: reason === item ? 'check_circle' : 'radio_button_unchecked' }} size={22} tintColor={colors.onSurface}
                accessible={false} importantForAccessibility="no-hide-descendants" />
              <RNText style={{ color: colors.onSurface, flex: 1, fontSize: 16, fontWeight: '400' }}>{item}</RNText>
            </Pressable>)}
          </View>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }} layoutDirection={direction}>
            <OutlinedTextField value={commentState} onValueChange={setComment} minLines={2} maxLines={4} modifiers={[fillMaxWidth()]}>
              <OutlinedTextField.Label><Text>{text('extraCommentLabel')}</Text></OutlinedTextField.Label>
              <OutlinedTextField.Placeholder><Text>{text('optionalReasonHint')}</Text></OutlinedTextField.Placeholder>
            </OutlinedTextField></Host>
        </ScrollView>
      </View></RNHostView></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton onClick={onCancel}><Text>{text('no')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={!!input} onClick={() => { if (input) onConfirm(input); }}><Text>{text('yes')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}
