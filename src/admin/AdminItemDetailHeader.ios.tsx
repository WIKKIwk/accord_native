import { Button, HStack, Image, RNHostView, Spacer, Text, VStack, ProgressView } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminItemDetailThumbnail } from './AdminItemDetailThumbnail';
import type { AdminItemDetailReadModel } from './AdminItemDetailReadOwner';
import type { AdminItemDetailNativeHeaderRenderer } from './AdminItemDetailReadTypes';

/** A real visible native-header ancestor is required; no hidden file Stack.Screen is substituted. */
export function AdminItemDetailTopBar({ model, backLabel, renderNativeHeader }: { model: AdminItemDetailReadModel; backLabel: string; renderNativeHeader: AdminItemDetailNativeHeaderRenderer }) {
  const { colors } = useBaseTheme();
  return renderNativeHeader(Object.freeze({ title: model.a('detail.item_title'), isCurrent: model.current, canInteract: model.canInteract,
    backAction: <BaseHost matchContents><Button onPress={model.back} modifiers={[buttonStyle('plain'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(backLabel), accessibilityIdentifier('admin-item-detail-back')]}><Image systemName="chevron.left" size={20} modifiers={[foregroundStyle(colors.onSurface)]} /></Button></BaseHost>,
  }));
}
/** @v2 _ItemDetailHeader */
export function AdminItemDetailHeader({ model, imageUrl = '' }: { model: AdminItemDetailReadModel; imageUrl?: string }) {
  const { colors } = useBaseTheme(), value = model.presentation; if (!value) return null; const ordinary = value.kind === 'ordinary';
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 18 }), background(colors.surface), cornerRadius(20)]}>
    <HStack alignment={ordinary ? 'center' : 'top'} spacing={14} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      {ordinary ? <Image systemName="shippingbox.fill" size={24} modifiers={[foregroundStyle(colors.onSecondaryContainer), frame({ width: 48, height: 48 }), background(colors.secondaryContainer), cornerRadius(14)]} />
        : <HStack modifiers={[frame({ width: 56, height: 56 })]}><RNHostView matchContents><View style={{ width: 56, height: 56 }}><AdminItemDetailThumbnail context={model.context} imageUrl={imageUrl} testID={`admin-${value.kind === 'combo' ? 'combo' : 'finished'}-item-image`} /></View></RNHostView></HStack>}
      <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{value.title}</Text>{value.showCode ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{value.code}</Text> : null}</VStack>
      {!ordinary ? <Button onPress={() => model.dispatch('actions')} modifiers={[buttonStyle('plain'), disabled(!value.actionsEnabled), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(value.actionsLabel), accessibilityIdentifier(`admin-${value.kind === 'combo' ? 'combo' : 'finished'}-item-actions`)]}><Image systemName="ellipsis" size={22} modifiers={[foregroundStyle(colors.onSurfaceVariant)]} /></Button> : null}
    </HStack>
    {value.badge ? <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), padding({ horizontal: 12, vertical: 6 }), foregroundStyle(colors.onSecondaryContainer), background(colors.secondaryContainer), cornerRadius(999), padding({ top: 14 }), accessibilityIdentifier(`admin-${value.kind === 'combo' ? 'combo' : 'finished'}-item-badge`)]}>{value.badge}</Text> : null}
    {ordinary ? <><Spacer modifiers={[frame({ height: 16 })]} /><Button onPress={() => model.dispatch('edit')} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!value.editEnabled), frame({ maxWidth: Infinity, minHeight: 56 }), cornerRadius(20), accessibilityIdentifier('admin-item-detail-edit')]}><HStack spacing={8}>{value.editBusy ? <ProgressView /> : <Image systemName="pencil" size={18} />}<Text modifiers={[font({ textStyle: 'body', weight: 'medium' })]}>{value.editLabel}</Text></HStack></Button></> : null}
  </VStack></BaseHost>;
}
