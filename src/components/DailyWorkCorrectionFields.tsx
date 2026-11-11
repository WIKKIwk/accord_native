import { WorkerFormField } from './WorkerFormField';
import { useWorkerOrderText } from './useWorkerOrderText';
import type { DailyWorkCorrectionFieldsProps } from './dailyWorkCorrectionFieldsTypes';

export function DailyWorkCorrectionFields({ edit, controller }: DailyWorkCorrectionFieldsProps) {
  const { p } = useWorkerOrderText();
  return edit.step === 'edit' ? <>
    {edit.fields.map(field => <WorkerFormField key={`${edit.batch.id}:${field.key}`} label={`${p(`worker.daily.field.${field.label}`)} (${field.unit})`}
      initialValue={edit.values[field.key]} keyboardType="decimal-pad" onChangeText={value => controller.change(field.key, value)} />)}
    <WorkerFormField key={`${edit.batch.id}:description`} label={p('worker.daily.field.note')} initialValue={edit.values.description} onChangeText={value => controller.change('description', value)} />
  </> : <WorkerFormField key={`${edit.batch.id}:reason`} label={p('worker.daily.correction.hint')} initialValue={edit.reason} onChangeText={controller.reason} />;
}
