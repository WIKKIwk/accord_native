import { Button, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, buttonStyle, controlSize, font, frame } from '@expo/ui/swift-ui/modifiers';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminItemCreateDialogCard } from './AdminItemCreateDialogCard.ios';
import type { AdminItemCreateDialogPresentation } from './AdminItemCreateDialogTypes';
import { AdminItemCreatePicker } from './AdminItemCreatePicker.ios';
import { useAdminItemCreateOverlays } from './useAdminItemCreateOverlays';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

/** UIKit owns its real onDismiss acknowledgement. Outside/back remain permitted while the command saves. */
function Dialog(props: AdminItemCreateDialogPresentation) {
  const request = () => { if (isSynchronouslyTrue(props.canInteract)) props.onDismissRequest(); };
  return <Modal transparent visible={props.visible} animationType="fade" presentationStyle="overFullScreen" onRequestClose={request} onDismiss={props.onDismissed}>
    <SafeAreaView style={[styles.root, { backgroundColor: `rgba(0,0,0,${props.scrimOpacity})` }]}><KeyboardAvoidingView behavior="padding" style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={request} accessibilityRole="button" />
      <View style={[styles.content, { paddingHorizontal: props.horizontalInset }]}><View style={[styles.width, { maxWidth: props.maxWidth }]}>{props.children}</View></View>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}
export function AdminItemCreateOverlays({ model }: { model: AdminItemCreateScreenModel }) {
  const presented = useAdminItemCreateOverlays(model), { colors } = useBaseTheme(); if (!model.current()) return null;
  const { create, move, controller } = presented;
  return <>
    {create ? <Dialog identity={create.identity} kind="create" visible={presented.createVisible} isCurrent={() => model.current() && controller.getSnapshot().create?.identity === create.identity}
      isClosing={() => model.current() && controller.getSnapshot().create?.identity === create.identity && !controller.getSnapshot().createVisible} canInteract={() => model.dialogNativeCurrent(create.dialog)} scrimOpacity={.32} horizontalInset={20} maxWidth={440}
      onDismissRequest={() => model.closeDialog(true)} onDismissed={() => controller.completeCreate(create)}>
      <AdminItemCreateDialogCard model={model} dialog={create.dialog} />{model.state.picker ? <BaseHost style={styles.overlay}><AdminItemCreatePicker key={model.state.picker.id} model={model} /></BaseHost> : null}
    </Dialog> : null}
    {move ? <Dialog identity={move.identity} kind="move" visible={presented.moveVisible} isCurrent={() => model.current() && controller.getSnapshot().move?.identity === move.identity}
      isClosing={() => model.current() && controller.getSnapshot().move?.identity === move.identity && !controller.getSnapshot().moveVisible} canInteract={model.moveNativeCurrent} scrimOpacity={.54} horizontalInset={40} maxWidth={560}
      onDismissRequest={() => presented.chooseMove(move, false)} onDismissed={() => { void controller.completeMove(move); }}>
      <View style={[styles.confirmation, { backgroundColor: colors.surfaceContainerHigh }]}><BaseHost matchContents={{ vertical: true }} style={styles.width}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'title2' })]}>{model.a('bulk_move.move_title')}</Text><Spacer modifiers={[frame({ height: 16 })]} /><Text>{model.a('bulk_move.confirm', { count: move.prompt.codes.length, group: move.prompt.group })}</Text><Spacer modifiers={[frame({ height: 24 })]} />
        <Button label={model.a('bulk_move.yes')} onPress={() => presented.chooseMove(move, true)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-items-move-confirm')]} /><Spacer modifiers={[frame({ height: 8 })]} />
        <VStack modifiers={[frame({ maxWidth: Infinity })]}><Button label={model.a('bulk_move.no')} onPress={() => presented.chooseMove(move, false)} modifiers={[buttonStyle('plain'), accessibilityIdentifier('admin-items-move-cancel')]} /></VStack>
      </VStack></BaseHost></View>
    </Dialog> : null}
  </>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }, width: { width: '100%', flexShrink: 1 }, overlay: { position: 'absolute', width: '100%' }, confirmation: { width: '100%', padding: 24, borderRadius: 28, overflow: 'hidden' } });
