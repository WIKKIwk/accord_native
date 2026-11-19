import { Column, IconButton, RNHostView, Row, Spacer, Surface, Button } from '@expo/ui/jetpack-compose';
import { AdminTopBar } from './AdminTopBar.android';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import { AdminText as Text } from './AdminTypography.android';
import { ItemDetailIcon, ItemDetailSpinner, itemDetailDisabled, itemDetailRounded } from './AdminItemDetailNative.android';
import { AdminItemDetailThumbnail } from './AdminItemDetailThumbnail';
import type { AdminItemDetailReadModel } from './AdminItemDetailReadOwner';

export function AdminItemDetailTopBar({ model, backLabel }: { model: AdminItemDetailReadModel; backLabel: string }) {
  const { colors, chromeBackground } = useAdminShellTheme();
  return <SafeAreaView edges={['left', 'right']}><BaseHost style={{ width: '100%', height: 63 }}><Column modifiers={[fillMaxWidth()]}>
    <AdminTopBar leading={<IconButton onClick={model.back} modifiers={[semantics({ contentDescription: backLabel }), testID('admin-item-detail-back')]}><ItemDetailIcon name="arrow_back" color={colors.onSurface} /></IconButton>}
      title={<Text style={{ typography: 'titleLarge', fontSize: 24, fontWeight: '800' }}>{model.a('detail.item_title')}</Text>} /><Surface color={chromeBackground} modifiers={[fillMaxWidth(), height(3)]} />
  </Column></BaseHost></SafeAreaView>;
}
/** @v2 _ItemDetailHeader */
export function AdminItemDetailHeader({ model, imageUrl = '' }: { model: AdminItemDetailReadModel; imageUrl?: string }) {
  const { colors } = useBaseTheme(), value = model.presentation; if (!value) return null;
  const ordinary = value.kind === 'ordinary';
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Surface color={colors.surface} shape={itemDetailRounded(20)}>
    <Column modifiers={[fillMaxWidth(), padding(18, 18, 18, 18)]}>
      <Row verticalAlignment={ordinary ? 'center' : 'top'} modifiers={[fillMaxWidth()]}>
        {ordinary ? <Surface color={colors.secondaryContainer} shape={itemDetailRounded(14)} modifiers={[size(48, 48)]}><Row horizontalArrangement="center" verticalAlignment="center" modifiers={[size(48, 48)]}><ItemDetailIcon name="inventory_2" color={colors.onSecondaryContainer} /></Row></Surface>
          : <RNHostView modifiers={[size(56, 56)]}><AdminItemDetailThumbnail context={model.context} imageUrl={imageUrl} testID={`admin-${value.kind === 'combo' ? 'combo' : 'finished'}-item-image`} /></RNHostView>}
        <Spacer modifiers={[size(14, 1)]} /><Column modifiers={[weight(1)]}>
          <Text style={{ typography: 'titleLarge', fontWeight: '800' }}>{value.title}</Text>{value.showCode ? <><Spacer modifiers={[height(3)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{value.code}</Text></> : null}
        </Column>
        {!ordinary ? <IconButton enabled={value.actionsEnabled} onClick={() => model.dispatch('actions')} modifiers={[size(40, 40), semantics({ contentDescription: value.actionsLabel }), testID(`admin-${value.kind === 'combo' ? 'combo' : 'finished'}-item-actions`)]}><ItemDetailIcon name="more_horiz" color={value.actionsEnabled ? colors.onSurfaceVariant : itemDetailDisabled(colors.onSurface)} /></IconButton> : null}
      </Row>
      {value.badge ? <><Spacer modifiers={[height(14)]} /><Surface color={colors.secondaryContainer} shape={itemDetailRounded(999)} modifiers={[testID(`admin-${value.kind === 'combo' ? 'combo' : 'finished'}-item-badge`)]}><Text color={colors.onSecondaryContainer} style={{ typography: 'labelMedium', fontWeight: '600' }} modifiers={[padding(12, 6, 12, 6)]}>{value.badge}</Text></Surface></> : null}
      {ordinary ? <><Spacer modifiers={[height(16)]} /><Button enabled={value.editEnabled} onClick={() => model.dispatch('edit')} shape={itemDetailRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-item-detail-edit')]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>{value.editBusy ? <ItemDetailSpinner /> : <ItemDetailIcon name="edit" color={value.editEnabled ? colors.onPrimary : itemDetailDisabled(colors.onSurface)} iconSize={18} />}<Text style={{ fontSize: 16, fontWeight: '500' }}>{value.editLabel}</Text></Row>
      </Button></> : null}
    </Column>
  </Surface></BaseHost>;
}
