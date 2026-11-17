import { Button, HStack, Image, ProgressView, Text } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, cornerRadius, disabled, font, foregroundStyle, frame, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { useMemo } from 'react';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import { useAdminItemCreatePrimaryAction } from './useAdminItemCreatePrimaryAction';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';
import { useAdminSourceSceneScaffold } from './AdminSourceSceneScaffoldContext';
import { useAdminSourceScenePrimary } from './useAdminSourceScenePrimary';

function Move({ moving, submitting, label, onPress }: { moving: boolean; submitting: boolean; label: string; onPress: () => void }) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents><Button onPress={onPress} modifiers={[buttonStyle('plain'), disabled(moving), accessibilityIdentifier('admin-items-move-fab')]}>
    <HStack spacing={8} modifiers={[padding({ leading: 16, trailing: 20 }), frame({ height: 80 }), background(colors.primaryContainer), cornerRadius(22), foregroundStyle(colors.onPrimaryContainer)]}>
      {submitting ? <ProgressView modifiers={[frame({ width: 24, height: 24 }), tint(colors.primary)]} /> : <Image systemName="folder" size={24} />}<Text modifiers={[font({ textStyle: 'headline', weight: 'medium' })]}>{label}</Text>
    </HStack>
  </Button></BaseHost>;
}
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
