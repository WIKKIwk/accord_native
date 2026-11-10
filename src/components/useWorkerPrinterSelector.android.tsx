import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { selectPreparationDevice } from '../preparation/preparationDevicePicker.android';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerFormField } from './WorkerFormField';
import { WorkerRadioChoice } from './WorkerRadioChoice';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';
type Choice = { label: string; subtitle?: string; value: string };
type Dialog = { title: string; choices?: Choice[]; message?: string; initialValue?: string };
export function useWorkerPrinterSelector(current: () => boolean) {
  const colors = useWorkerColors(), { t } = useWorkerOrderText();
  const [dialog, setDialog] = useState<Dialog | null>(null), [value, setValue] = useState('');
  const pending = useRef<((value: string | null) => void) | null>(null);
  const finish = (result: string | null) => { pending.current?.(result); pending.current = null; setDialog(null); };
  useEffect(() => () => { pending.current?.(null); pending.current = null; }, []);
  const open = (next: Dialog) => new Promise<string | null>(resolve => {
    if (!current() || pending.current) { resolve(null); return; }
    pending.current = resolve; setValue(next.initialValue ?? ''); setDialog(next);
  });
  return { selectDevice: () => selectPreparationDevice({
    choose: (title: string, choices: Choice[], message?: string) => open({ title, choices, message }),
    input: (options: { title: string; initial?: string; label?: string }) => open({ title: options.title, initialValue: options.initial, message: options.label }),
  } as Parameters<typeof selectPreparationDevice>[0], current), dialogs: <WorkerFormDialog visible={!!dialog} title={t(dialog?.title ?? '')}
    confirmLabel={t('Tasdiqlash')} confirmDisabled={!value.trim()} onConfirm={() => finish(value)} onCancel={() => finish(null)} cancelLabel={t('Bekor qilish')}>
    {!!dialog?.message && <Text style={{ color: colors.text }}>{t(dialog.message)}</Text>}
    {dialog?.choices ? dialog.choices.map(choice => <WorkerRadioChoice key={choice.value} label={[t(choice.label), choice.subtitle].filter(Boolean).join('\n')}
      selected={value === choice.value} onPress={() => finish(choice.value)} />) : <WorkerFormField key={dialog?.title} label={t(dialog?.title ?? '')} initialValue={dialog?.initialValue} onChangeText={setValue} />}
  </WorkerFormDialog> };
}
