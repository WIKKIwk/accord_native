import { Button, CircularProgressIndicator, Row, Spacer, Surface } from '@expo/ui/jetpack-compose';
import { defaultMinSize, height, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useMemo } from 'react';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import { AdminText as Text } from './AdminTypography.android';
import { ItemCreateIcon, itemCreateRounded } from './AdminItemCreateNative.android';
import { useAdminItemCreatePrimaryAction } from './useAdminItemCreatePrimaryAction';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';
import { useAdminSourceSceneScaffold } from './AdminSourceSceneScaffoldContext';
import { useAdminSourceScenePrimary } from './useAdminSourceScenePrimary';

function Move({ moving, submitting, label, onPress }: { moving: boolean; submitting: boolean; label: string; onPress: () => void }) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents><Surface color={colors.primaryContainer} shadowElevation={6} shape={itemCreateRounded(22)}><Button enabled={!moving} onClick={onPress} shape={itemCreateRounded(22)}
    colors={{ containerColor: 'transparent', disabledContainerColor: 'transparent', contentColor: colors.onPrimaryContainer, disabledContentColor: colors.onPrimaryContainer }} contentPadding={{ start: 16, end: 20, top: 0, bottom: 0 }} modifiers={[height(80), defaultMinSize({ minWidth: 80, minHeight: 0 }), testID('admin-items-move-fab')]}>
    <Row verticalAlignment="center">{submitting ? <CircularProgressIndicator color={colors.primary} strokeWidth={2} modifiers={[size(24, 24)]} /> : <ItemCreateIcon name="drive_file_move" color={colors.onPrimaryContainer} />}<Spacer modifiers={[size(8, 1)]} /><Text style={{ fontSize: 16, fontWeight: '500' }}>{label}</Text></Row>
  </Button></Surface></BaseHost>;
}
/** Registers Source custom add action or genuine move replacement in the root FAB host. */
function Presentation({ model, render }: { model: AdminItemCreateScreenModel; render?: AdminItemCreateScreenProps['renderPrimaryAction'] }) {
  const primary = useAdminItemCreatePrimaryAction(model);
  const { moving, submittingMove: submitting } = model.state.list, count = model.state.list.selectedCodes.length, label = `${model.a('bulk_move.action')} (${count})`, onPress = primary.requestMove;
  const replacement = useMemo(() => count ? <Move moving={moving} submitting={submitting} label={label} onPress={onPress} /> : undefined, [count, moving, submitting, label, onPress]);
  const props = { isCurrent: model.current, canInteract: primary.canInteract, actions: primary.actions, replacement };
  return render ? render(props) : <SourcePrimary {...props} />;
}
function SourcePrimary(props: Parameters<typeof useAdminSourceScenePrimary>[0]) { useAdminSourceScenePrimary(props); return null; }
export function AdminItemCreatePrimaryAction({ model, render }: { model: AdminItemCreateScreenModel; render?: AdminItemCreateScreenProps['renderPrimaryAction'] }) {
  const source = useAdminSourceSceneScaffold(); if (!source && !render) throw TypeError('The genuine original primary renderer is required');
  return <Presentation model={model} render={source ? undefined : render} />;
}
