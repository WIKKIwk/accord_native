import { BaseHost } from './BaseHost';
import { WorkerNativeField } from './DailyWorkCorrectionFields.ios';

type Props = { label: string; onChangeText: (value: string) => void; keyboardType?: 'decimal-pad' | 'default'; initialValue?: string; multiline?: boolean };

export function WorkerFormField({ label, onChangeText, keyboardType, initialValue = '', multiline = false }: Props) {
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <WorkerNativeField label={label} value={initialValue} change={onChangeText} decimal={keyboardType === 'decimal-pad'}
      maskDecimal={false} multiline={multiline} />
  </BaseHost>;
}
