import { Button, Text } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from './BaseHost';
import type { WorkerFramePrintProps } from './workerReportFieldTypes';

export function WorkerFramePrint({ label, disabled: inactive, press, longPress }: WorkerFramePrintProps) {
  return <BaseHost matchContents={{ vertical: true }}><Button onPress={press} modifiers={[buttonStyle('bordered'), disabled(inactive),
    ...(longPress ? [onLongPressGesture(() => { if (!inactive) longPress(); }, 0.5)] : [])]}><Text>{label}</Text></Button></BaseHost>;
}
