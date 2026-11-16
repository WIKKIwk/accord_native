import { Button, HStack, Image, ProgressView, Text } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, cornerRadius, disabled, font, foregroundStyle, frame, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import { useAdminItemCreatePrimaryAction } from './useAdminItemCreatePrimaryAction';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

function Move({ model }: { model: AdminItemCreateScreenModel }) {
  const { colors } = useBaseTheme(), state = model.state.list;
  return <BaseHost matchContents><Button onPress={model.requestMove} modifiers={[buttonStyle('plain'), disabled(state.moving), accessibilityIdentifier('admin-items-move-fab')]}>
    <HStack spacing={8} modifiers={[padding({ leading: 16, trailing: 20 }), frame({ height: 80 }), background(colors.primaryContainer), cornerRadius(22), foregroundStyle(colors.onPrimaryContainer)]}>
      {state.submittingMove ? <ProgressView modifiers={[frame({ width: 24, height: 24 }), tint(colors.primary)]} /> : <Image systemName="folder" size={24} />}<Text modifiers={[font({ textStyle: 'headline', weight: 'medium' })]}>{`${model.a('bulk_move.action')} (${state.selectedCodes.length})`}</Text>
    </HStack>
  </Button></BaseHost>;
}
export function AdminItemCreatePrimaryAction({ model, render }: { model: AdminItemCreateScreenModel; render: AdminItemCreateScreenProps['renderPrimaryAction'] }) {
  const primary = useAdminItemCreatePrimaryAction(model);
  return render({ isCurrent: model.current, canInteract: primary.canInteract, actions: primary.actions, replacement: model.state.list.selectedCodes.length ? <Move model={model} /> : undefined });
}
