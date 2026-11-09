import { Button, Host, HStack, Image, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityHidden, buttonStyle, contentShape, disabled, fixedSize, font, frame, keyboardType, lineLimit,
  padding, shapes, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Modal, PlatformColor, Pressable, ScrollView, View } from 'react-native';
import { useCustomerText } from './CustomerContext';
import { customerReturnInput } from './customerLogic';
import { customerReturnTitleKey, type CustomerReturnDialogProps, type CustomerReturnKind } from './customerDeliveryView';
import { customerLayoutDirection } from './customerPresentation';

export function CustomerReturnDialog(props: CustomerReturnDialogProps) {
  if (!props.kind) return null;
  return <ReturnDialogForm key={props.kind} {...props} kind={props.kind} />;
}
function ReturnDialogForm({ kind, sentQty, uom, onCancel, onConfirm }: Omit<CustomerReturnDialogProps, 'kind'> & { kind: CustomerReturnKind }) {
  const { locale, text } = useCustomerText(), quantityState = useNativeState(''), commentState = useNativeState('');
  const [quantity, setQuantity] = useState(''), [comment, setComment] = useState(''), [reason, setReason] = useState<string | null>(null);
  const reasons = ['rejectReasonDefective', 'rejectReasonWrongItem', 'rejectReasonQtyMismatch'].map(text);
  const input = customerReturnInput({ sentQty, rawQty: quantity, selectedReason: reason, comment,
    requireQtyEntry: kind !== 'reject', allowFullReturn: kind !== 'partial' });
  const direction = customerLayoutDirection(locale);
  return <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={text('no')} onPress={onCancel}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#00000047' }} />
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 420, maxHeight: '85%', backgroundColor: PlatformColor('systemBackground'), borderRadius: 28, padding: 22,
        direction: direction === 'rightToLeft' ? 'rtl' : 'ltr' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }} layoutDirection={direction}><VStack alignment="leading" spacing={8}>
            <Text>{text(customerReturnTitleKey(kind))}</Text>
            {kind !== 'reject' ? <><Text>{text(kind === 'partial' ? 'returningQtyLabel' : 'returnedQtyLabel')}</Text>
              <HStack><TextField text={quantityState} placeholder={`${sentQty.toFixed(2)} ${uom}`} onTextChange={setQuantity}
                modifiers={[keyboardType('decimal-pad'), textFieldStyle('roundedBorder'), frame({ maxWidth: Infinity })]} /><Text>{uom}</Text></HStack></> : null}
            <Text>{text('reasonLabel')}</Text>
          </VStack></Host>
          {reasons.map((item, index) => <Host key={item} matchContents={{ vertical: true }} style={{ width: '100%' }} layoutDirection={direction}>
            <Button testID={`customer-reason-${index}`} onPress={() => setReason(reason === item ? null : item)}
              modifiers={[buttonStyle('plain'), ...(reason === item ? [accessibilityAddTraits(['isSelected'])] : [])]}>
              <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: 10 }), contentShape(shapes.rectangle())]}>
                <Image systemName={reason === item ? 'checkmark.circle.fill' : 'circle'} size={22} modifiers={[accessibilityHidden()]} />
                <Text modifiers={[font({ textStyle: 'body' }), lineLimit(), fixedSize({ horizontal: false, vertical: true })]}>{item}</Text>
              </HStack>
            </Button>
          </Host>)}
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }} layoutDirection={direction}><VStack alignment="leading" spacing={6}>
            <Text>{text('extraCommentLabel')}</Text><TextField text={commentState} axis="vertical" placeholder={text('optionalReasonHint')}
              onTextChange={setComment} modifiers={[textFieldStyle('roundedBorder'), lineLimit({ min: 2, max: 4 }), frame({ maxWidth: Infinity })]} />
          </VStack></Host>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }} layoutDirection={direction}><HStack spacing={12}>
            <Button label={text('no')} onPress={onCancel} modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity })]} />
            <Button label={text('yes')} onPress={() => { if (input) onConfirm(input); }}
              modifiers={[buttonStyle('borderedProminent'), disabled(!input), frame({ maxWidth: Infinity })]} />
          </HStack></Host>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
