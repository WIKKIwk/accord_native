import { Text } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { BaseHost } from '../components/BaseHost';
import { WorkerFormDialog } from '../components/WorkerFormDialog';
import { WorkerReportField } from '../components/WorkerReportField';
import { usePreparationText } from './PreparationUI';
import type { PreparationNoteDialogEditor } from './usePreparationOutputNotes';

export function PreparationProductionNoteDialog({ editor, title = 'Buyurtma eslatmasi',
  description = 'Bu eslatma buyurtma uchun ishlab chiqarilgan barcha homashyolarga tegishli.' }:
  { editor: PreparationNoteDialogEditor; title?: string; description?: string }) {
  const t = usePreparationText(), { state } = editor;
  if (!state.original) return null;
  return <WorkerFormDialog visible title={t(title)} confirmLabel={t(state.saving ? 'Saqlanmoqda…' : 'Saqlash')}
    onConfirm={() => void editor.save()} confirmDisabled={!editor.canSave} onCancel={editor.cancel}
    cancelDisabled={state.saving} preventDismiss={state.saving}>
    <WorkerReportField label={t('Eslatma')} value={state.draft} change={editor.change} multiline focus={1} disabled={state.saving} />
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Text modifiers={[foregroundStyle(PlatformColor('secondaryLabel'))]}>
      {t(description)}
    </Text></BaseHost>
    <BaseHost matchContents><Text modifiers={[foregroundStyle(PlatformColor(editor.count > editor.limit ? 'systemRed' : 'secondaryLabel'))]}>{`${editor.count} / ${editor.limit}`}</Text></BaseHost>
    {state.error ? <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{t(state.error)}</Text></BaseHost> : null}
  </WorkerFormDialog>;
}
