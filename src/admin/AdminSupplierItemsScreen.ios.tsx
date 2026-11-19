import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { Button, Divider, HStack, Image, ProgressView, ScrollView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, labelStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { Modal, Pressable, ScrollView as RNScrollView, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import type { AdminSupplierItemsPageProps, AdminSupplierItemsScreenProps } from './AdminSupplierItemsScreenTypes';
import { useAdminSupplierItems, useAdminSupplierItemsConfirmation, type AdminSupplierItemsScreenModel } from './useAdminSupplierItems';

/** @v2 ItemsTable and ItemsTableHeader */
export function SupplierItemsTable({ model }: { model: AdminSupplierItemsScreenModel }) {
  const { colors } = useBaseTheme();
  if (!model.state.items.length) return <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
    <Text modifiers={[font({ textStyle: 'headline' }), padding({ all: 18 }), background(colors.surface), cornerRadius(24)]}>{model.empty}</Text>
  </VStack>;
  return <ScrollView><VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(colors.surface), cornerRadius(24)]}>
    <HStack spacing={0} modifiers={[padding({ horizontal: 12, vertical: 12 }), frame({ maxWidth: Infinity })]}>
      <Text modifiers={[font({ textStyle: 'caption' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a('supplier_items.item')}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a('supplier_items.code')}</Text><Spacer modifiers={[frame({ width: 44 })]} />
    </HStack>
    {model.state.items.map((item, index) => <VStack key={`${item.code}:${index}`} spacing={0}>
      <HStack spacing={0} modifiers={[padding({ horizontal: 12, vertical: 10 }), frame({ maxWidth: Infinity })]}>
        <Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{item.name}</Text><Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{item.code}</Text>
        <Button onPress={() => model.request(item)} modifiers={[buttonStyle('plain'), disabled(model.state.mutating), frame({ width: 44, height: 44 }), accessibilityIdentifier(`admin-supplier-items-action-${index}`)]}>
          <Image systemName={model.mode === 'add' ? 'plus' : 'minus'} size={22} />
        </Button>
      </HStack><Divider />
    </VStack>)}
  </VStack></ScrollView>;
}
export function SupplierItemConfirmation({ model }: { model: AdminSupplierItemsScreenModel }) {
  const host = useAdminSupplierItemsConfirmation(model), { colors } = useBaseTheme(); if (!host.visible) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={() => host.choose(false)}><View style={styles.modal}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={() => host.choose(false)} />
    <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surfaceContainerHigh }]}><RNScrollView style={styles.dialogScroll}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={0} modifiers={[padding({ leading: 24, top: 24, trailing: 24, bottom: 20 }), frame({ maxWidth: Infinity })]}>
        <Text modifiers={[font({ textStyle: 'title2' })]}>{model.a(model.mode === 'add' ? 'supplier_items.add_title' : 'supplier_items.remove_title')}</Text><Spacer modifiers={[frame({ height: 10 })]} />
        <Text modifiers={[foregroundStyle('secondary')]}>{model.a(model.mode === 'add' ? 'supplier_items.add_message' : 'supplier_items.remove_message', { item: model.state.prompt!.item.name })}</Text><Spacer modifiers={[frame({ height: 22 })]} />
        <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
          <Button onPress={() => host.choose(false)} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-supplier-items-cancel')]}>
            <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a('bulk_move.no')}</Text>
          </Button>
          <Button onPress={() => host.choose(true)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-supplier-items-confirm')]}>
            <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a('bulk_move.yes')}</Text>
          </Button>
        </HStack>
      </VStack></BaseHost>
    </RNScrollView></View>
  </View></Modal>;
}
export function AdminSupplierItemsScreen(props: AdminSupplierItemsScreenProps) {
  const model = useAdminSupplierItems(props), { chromeBackground } = useAdminShellTheme(); if (!model.current() || !model.state.valid) return null;
  return <><Stack.Screen options={{ headerShown: true, title: model.title, headerBackVisible: false, headerRight: () => props.profileAction,
    headerLeft: () => <BaseHost matchContents><Button label={props.backLabel} systemImage="chevron.left" onPress={model.back} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'),
      frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(props.backLabel)]} /></BaseHost> }} />
    <View style={[styles.screen, { backgroundColor: chromeBackground }]}><AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-supplier-items-body-frame" contentPadding="default"><View style={styles.content}><BaseHost style={styles.body}>
      {model.state.loading ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack> : <SupplierItemsTable model={model} />}
    </BaseHost></View></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
      {model.state.prompt ? <SupplierItemConfirmation key={`${model.generation}:${model.state.prompt.serial}`} model={model} /> : null}
    </View>
  </>;
}
/** @v2 AdminSupplierItemsViewScreen */
export function AdminSupplierItemsViewScreen(props: AdminSupplierItemsPageProps) { return <AdminSupplierItemsScreen {...props} mode="view" />; }
/** @v2 AdminSupplierItemsAddScreen */
export function AdminSupplierItemsAddScreen(props: AdminSupplierItemsPageProps) { return <AdminSupplierItemsScreen {...props} mode="add" />; }
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' },
  content: { flex: 1, paddingTop: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, modal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,.54)' },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '100%', borderRadius: 28, overflow: 'hidden' }, dialogScroll: { flexGrow: 0, flexShrink: 1 } });
