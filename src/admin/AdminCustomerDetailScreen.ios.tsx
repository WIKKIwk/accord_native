import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { Button, HStack, Image, RNHostView, ScrollView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, animation, Animation, background, buttonStyle, clipped, cornerRadius, font, foregroundStyle, frame, labelStyle, lineLimit, multilineTextAlignment, padding, rotationEffect } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { CustomerControls, CustomerInfoChip, CustomerPrompt } from './AdminCustomerDetailNative.ios';
import { CustomerSheetStack } from './AdminCustomerDetailSheets.ios';
import type { AdminCustomerDetailScreenProps } from './AdminCustomerDetailScreenTypes';
import { dartTrim } from './dartJsonString';
import { useAdminCustomerDetail, type AdminCustomerDetailScreenModel } from './useAdminCustomerDetail';

function Header({ model, props }: { model: AdminCustomerDetailScreenModel; props: AdminCustomerDetailScreenProps }) {
  const { colors } = useBaseTheme();
  return <RNHostView matchContents={{ vertical: true }}><View style={styles.profileHeader}>
    <View style={styles.banner} /><View style={styles.status}><BaseHost matchContents><Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle(colors.onSecondaryContainer),
      padding({ horizontal: 12, vertical: 8 }), background(colors.secondaryContainer), cornerRadius(999)]}>{model.status}</Text></BaseHost></View>
    <View style={styles.avatar}>{props.renderAvatar({ avatarUrl: model.detail.avatar_url, displayName: model.initials, fallbackText: model.initials, size: 92, isCurrent: model.current, canInteract: model.interactive })}</View>
    <View style={styles.identity}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={6}>
      <Text modifiers={[font({ textStyle: 'title2', weight: 'heavy' }), lineLimit(1)]}>{model.displayName}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{model.subtitle}</Text>
    </VStack></BaseHost></View>
  </View></RNHostView>;
}
function Detail({ model, props }: { model: AdminCustomerDetailScreenModel; props: AdminCustomerDetailScreenProps }) {
  const { state, detail, mode } = model, { colors } = useBaseTheme();
  return <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(colors.surface), cornerRadius(18), clipped(), animation(Animation.easeOut({ duration: .18 }), state.expanded)]}>
    <Header model={model} props={props} /><HStack alignment="bottom" spacing={8} modifiers={[padding({ leading: 16, trailing: 16, top: 2, bottom: 16 })]}>
      <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <CustomerInfoChip icon="phone.fill" label={dartTrim(detail.phone) || model.a('profile.phone_missing')} />
        {mode.material ? <><CustomerInfoChip icon="square.grid.2x2" label={model.a('detail.groups_count', { count: detail.assigned_item_groups.length })} /><CustomerInfoChip icon="building.2" label={model.a('detail.warehouses_count', { count: detail.assigned_warehouses.length })} /></> :
          <CustomerInfoChip icon="bag.fill" label={model.a('detail.items_count', { count: detail.assigned_items.length })} />}
        {props.chatAction ? <RNHostView matchContents>{props.chatAction}</RNHostView> : null}
      </VStack>
      {mode.management ? <Button onPress={model.toggle} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityLabel(model.a(state.expanded ? 'profile.controls_close' : 'profile.controls_open')), accessibilityIdentifier('admin-customer-detail-admin-toggle')]}>
        <Image systemName="chevron.down" size={20} modifiers={[foregroundStyle('secondary'), rotationEffect(state.expanded ? 180 : 0), animation(Animation.easeOut({ duration: .18 }), state.expanded)]} />
      </Button> : null}
    </HStack>{mode.management && state.expanded ? <CustomerControls key={`${model.generation}:${model.overlayGeneration}`} model={model} props={props} /> : null}
  </VStack>;
}
// @v2 AdminCustomerDetailScreen, including its always-visible fallback profile and independent native sheets.
export function AdminCustomerDetailScreen(props: AdminCustomerDetailScreenProps) {
  const model = useAdminCustomerDetail(props), { state } = model, { colors } = useBaseTheme();
  if (!model.current() || !state.valid || state.removed) return null;
  return <><Stack.Screen options={{ headerShown: true, title: model.title, headerBackVisible: false, gestureEnabled: false, headerRight: () => props.profileAction,
    headerLeft: () => <BaseHost matchContents><Button label={props.backLabel} systemImage="chevron.left" onPress={model.back} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(props.backLabel), accessibilityIdentifier('admin-customer-detail-back')]} /></BaseHost> }} />
    <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}><AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-customer-detail-body-frame"><BaseHost style={styles.body}>
      <ScrollView modifiers={[accessibilityIdentifier('admin-customer-detail-scroll')]}><VStack spacing={0} modifiers={[padding({ leading: 4, trailing: 4, top: 4, bottom: 116 }), frame({ maxWidth: Infinity })]}>
        <Detail model={model} props={props} />
        {model.mode.management ? <RNHostView matchContents={{ vertical: true }}><View style={styles.subordinate}>{props.renderApparatusCard(model.apparatus)}</View></RNHostView> : null}
        {state.loadError != null ? <VStack spacing={16} modifiers={[padding({ top: 12 }), frame({ maxWidth: Infinity })]}><Text modifiers={[foregroundStyle('secondary'), multilineTextAlignment('center')]}>{model.t('serverDisconnectedRetry')}</Text>
          <Button label={model.t('retry')} onPress={model.reload} modifiers={[accessibilityIdentifier('admin-customer-detail-retry')]} />
        </VStack> : null}
      </VStack></ScrollView>
      {model.overlays.sheets.length ? <CustomerSheetStack key={model.overlays.sheets[0].id} model={model} /> : null}
    </BaseHost></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>{model.notice ? <PreparationNotice message={model.notice} /> : null}
    {!model.overlays.sheets.length && state.prompt ? <CustomerPrompt key={`${model.generation}:${state.prompt.serial}`} model={model} /> : null}</View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  profileHeader: { height: 204, width: '100%' }, banner: { position: 'absolute', left: 0, right: 0, top: 0, height: 112, backgroundColor: '#000000' }, status: { position: 'absolute', right: 14, top: 14 },
  avatar: { position: 'absolute', left: 16, top: 74, width: 92, height: 92 }, identity: { position: 'absolute', left: 124, right: 16, top: 140 }, subordinate: { width: '100%', marginTop: 12 } });
