import { FilledTonalButton, Host, Text } from '@expo/ui/jetpack-compose';
import { combinedClickable } from '@expo/ui/jetpack-compose/modifiers';
import type { WorkerFramePrintProps } from './workerReportFieldTypes';

export function WorkerFramePrint({ label, disabled, press, longPress }: WorkerFramePrintProps) {
  return <Host matchContents={{ vertical: true }}><FilledTonalButton enabled={!disabled} onClick={press}
    modifiers={longPress && !disabled ? [combinedClickable({ onClick: press, onLongClick: longPress })] : []}><Text>{label}</Text></FilledTonalButton></Host>;
}
