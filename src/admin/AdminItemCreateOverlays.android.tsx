import { Button, Column, Spacer, TextButton } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, testID } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminText as Text } from './AdminTypography.android';
import { AdminItemCreateDialogCard } from './AdminItemCreateDialogCard.android';
import type { AdminItemCreateDialogPortal } from './AdminItemCreateDialogTypes';
import { itemCreateRounded } from './AdminItemCreateNative.android';
import { AdminItemCreatePicker } from './AdminItemCreatePicker.android';
import { useAdminItemCreateOverlays } from './useAdminItemCreateOverlays';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';

/** The actual Android window owner is required; this component cannot synthesize dismissal completion. */
export function AdminItemCreateOverlays({ model, portal, observer }: { model: AdminItemCreateScreenModel; portal: AdminItemCreateDialogPortal; observer: AdminPresentationWindowObserver }) {
  const presented = useAdminItemCreateOverlays(model), { colors } = useBaseTheme(); if (!model.current() || !isSynchronouslyTrue(portal.isAvailable)) return null;
  const { create, move, controller } = presented;
  return <>
    {create ? portal.render({ identity: create.identity, kind: 'create', visible: presented.createVisible, isCurrent: () => model.current() && controller.getSnapshot().create?.identity === create.identity,
      isClosing: () => model.current() && controller.getSnapshot().create?.identity === create.identity && !controller.getSnapshot().createVisible && model.owner.controller.getSnapshot().closingDialog?.id === create.dialog.id && model.owner.controller.getSnapshot().closingDialog?.generation === create.dialog.generation, canInteract: () => model.dialogNativeCurrent(create.dialog),
      scrimOpacity: .32, horizontalInset: 20, maxWidth: 440, onDismissRequest: () => model.closeDialog(true), onDismissed: () => controller.completeCreate(create),
      children: <><AdminItemCreateDialogCard model={model} dialog={create.dialog} />{model.state.picker ? <BaseHost style={styles.overlay}><AdminItemCreatePicker key={model.state.picker.id} model={model} observer={observer} /></BaseHost> : null}</> }) : null}
    {move ? portal.render({ identity: move.identity, kind: 'move', visible: presented.moveVisible, isCurrent: () => model.current() && controller.getSnapshot().move?.identity === move.identity,
      isClosing: () => model.current() && controller.getSnapshot().move?.identity === move.identity && !controller.getSnapshot().moveVisible, canInteract: model.moveNativeCurrent,
      scrimOpacity: .54, horizontalInset: 40, maxWidth: 560, onDismissRequest: () => presented.chooseMove(move, false), onDismissed: () => { void controller.completeMove(move); },
      children: <View style={[styles.confirmation, { backgroundColor: colors.surfaceContainerHigh }]}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth(), padding(24, 24, 24, 24)]}>
        <Text style={{ typography: 'headlineSmall' }}>{model.a('bulk_move.move_title')}</Text><Spacer modifiers={[height(16)]} /><Text style={{ typography: 'bodyMedium' }}>{model.a('bulk_move.confirm', { count: move.prompt.codes.length, group: move.prompt.group })}</Text><Spacer modifiers={[height(24)]} />
        <Button onClick={() => presented.chooseMove(move, true)} shape={itemCreateRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-items-move-confirm')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('bulk_move.yes')}</Text></Button><Spacer modifiers={[height(8)]} />
        <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><TextButton onClick={() => presented.chooseMove(move, false)} modifiers={[testID('admin-items-move-cancel')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('bulk_move.no')}</Text></TextButton></Column>
      </Column></BaseHost></View> }) : null}
  </>;
}
const styles = StyleSheet.create({ overlay: { position: 'absolute', width: '100%' }, confirmation: { width: '100%', borderRadius: 28, overflow: 'hidden' }, fullWidth: { width: '100%' } });
