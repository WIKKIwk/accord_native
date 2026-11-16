import { Button, CircularProgressIndicator, Row, Spacer, Surface } from '@expo/ui/jetpack-compose';
import { defaultMinSize, height, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import { AdminText as Text } from './AdminTypography.android';
import { ItemCreateIcon, itemCreateRounded } from './AdminItemCreateNative.android';
import { useAdminItemCreatePrimaryAction } from './useAdminItemCreatePrimaryAction';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

function Move({ model }: { model: AdminItemCreateScreenModel }) {
  const { colors } = useBaseTheme(), state = model.state.list;
  return <BaseHost matchContents><Surface color={colors.primaryContainer} shadowElevation={6} shape={itemCreateRounded(22)}><Button enabled={!state.moving} onClick={model.requestMove} shape={itemCreateRounded(22)}
    colors={{ containerColor: 'transparent', disabledContainerColor: 'transparent', contentColor: colors.onPrimaryContainer, disabledContentColor: colors.onPrimaryContainer }} contentPadding={{ start: 16, end: 20, top: 0, bottom: 0 }} modifiers={[height(80), defaultMinSize({ minWidth: 80, minHeight: 0 }), testID('admin-items-move-fab')]}>
    <Row verticalAlignment="center">{state.submittingMove ? <CircularProgressIndicator color={colors.primary} strokeWidth={2} modifiers={[size(24, 24)]} /> : <ItemCreateIcon name="drive_file_move" color={colors.onPrimaryContainer} />}<Spacer modifiers={[size(8, 1)]} /><Text style={{ fontSize: 16, fontWeight: '500' }}>{`${model.a('bulk_move.action')} (${state.selectedCodes.length})`}</Text></Row>
  </Button></Surface></BaseHost>;
}
/** Registers Source custom add action or genuine move replacement in the root FAB host. */
export function AdminItemCreatePrimaryAction({ model, render }: { model: AdminItemCreateScreenModel; render: AdminItemCreateScreenProps['renderPrimaryAction'] }) {
  const primary = useAdminItemCreatePrimaryAction(model);
  return render({ isCurrent: model.current, canInteract: primary.canInteract, actions: primary.actions, replacement: model.state.list.selectedCodes.length ? <Move model={model} /> : undefined });
}
