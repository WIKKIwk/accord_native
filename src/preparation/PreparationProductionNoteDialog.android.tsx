import { Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { WorkerFormDialog } from '../components/WorkerFormDialog';
import { WorkerReportField } from '../components/WorkerReportField';
import { usePreparationText } from './PreparationUI';
import type { PreparationNoteDialogEditor } from './usePreparationOutputNotes';

export function PreparationProductionNoteDialog({ editor, title = 'Buyurtma eslatmasi',
  description = 'Bu eslatma buyurtma uchun ishlab chiqarilgan barcha homashyolarga tegishli.' }:
  { editor: PreparationNoteDialogEditor; title?: string; description?: string }) {
  const t = usePreparationText(), colors = useMaterialColors(), { state } = editor;
  if (!state.original) return null;
  return <WorkerFormDialog visible title={t(title)} confirmLabel={t(state.saving ? 'Saqlanmoqda…' : 'Saqlash')}
    onConfirm={() => void editor.save()} confirmDisabled={!editor.canSave} onCancel={editor.cancel}
    cancelDisabled={state.saving} preventDismiss={state.saving}>
    <WorkerReportField label={t('Eslatma')} value={state.draft} change={editor.change} multiline focus={1} disabled={state.saving} />
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text color={colors.onSurfaceVariant}>
      {t(description)}
    </Text></Host>
    <Host matchContents><Text color={editor.count > editor.limit ? colors.error : colors.onSurfaceVariant}>{`${editor.count} / ${editor.limit}`}</Text></Host>
    {state.error ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text color={colors.error}>{t(state.error)}</Text></Host> : null}
  </WorkerFormDialog>;
}
