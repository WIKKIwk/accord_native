import { Alert, Button, Host, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, font, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { BaseHost } from './BaseHost';
import { useWorkerColors } from './useWorkerColors';
import type { WorkerPaddonDialogProps } from './workerPaddonPresentation';

function SuccessorAlert({ data, close, dismissed, width, height }: Pick<WorkerPaddonDialogProps, 'close' | 'dismissed'> & {
  data: NonNullable<WorkerPaddonDialogProps['data']>; width: number; height: number;
}) {
  const chosen = useRef(false), hidden = useRef(false), finished = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (fallback.current !== null) clearTimeout(fallback.current); }, []);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    if (fallback.current !== null) clearTimeout(fallback.current);
    dismissed();
  };
  const choose = (value: string | null) => {
    if (chosen.current || finished.current) return;
    chosen.current = true;
    close(value);
    if (hidden.current) finish();
  };
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <Alert title={data.title} isPresented onIsPresentedChange={presented => {
      if (presented || hidden.current || finished.current) return;
      hidden.current = true;
      if (chosen.current) finish();
      else fallback.current = setTimeout(() => choose(null), 250);
    }}>
      <Alert.Trigger><Text> </Text></Alert.Trigger>
      {data.message ? <Alert.Message><Text>{data.message}</Text></Alert.Message> : null}
      <Alert.Actions>
        <Button label={data.cancelLabel ?? ''} role="cancel" onPress={() => choose(null)} />
        <Button label={data.confirmLabel ?? ''} role={data.destructive ? 'destructive' : undefined}
          onPress={() => choose('confirm')} modifiers={[disabled(!!data.confirmDisabled)]} />
      </Alert.Actions>
    </Alert>
  </Host>;
}

// @v2 _PaddonScannedWipsDialog
export function WorkerPaddonDialog({ data, visible, close, dismissed, children }: WorkerPaddonDialogProps) {
  const colors = useWorkerColors(), { width, height } = useWindowDimensions();
  if (!data) return null;
  if (data.kind === 'successor') return <SuccessorAlert data={data} close={close} dismissed={dismissed} width={width} height={height} />;
  return <Modal visible={visible} transparent animationType="fade" onDismiss={dismissed} onRequestClose={() => close(null)}>
    <Pressable onPress={() => close(null)} style={{ flex: 1, backgroundColor: '#0007', justifyContent: 'center', alignItems: 'center', paddingVertical: 36 }}>
      <Pressable onPress={() => {}} accessibilityViewIsModal style={{ width: Math.min(500, width - 40), maxHeight: height - 100, padding: 22, borderRadius: 26, gap: 16, backgroundColor: colors.surface }}>
        <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={12}>
          <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>{data.title}</Text>
          {data.message ? <Text>{data.message}</Text> : null}
        </VStack></BaseHost>
        {children ? <View style={{ height: Math.min(400, Math.max(160, height * 0.45)) }}>{children}</View> : null}
        {data.choices ? <ScrollView style={{ flexShrink: 1 }}><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <VStack alignment="leading" spacing={8}>{data.choices.map(choice => <Button key={choice.id} label={choice.title}
            onPress={() => close(choice.id)} modifiers={[buttonStyle('plain'), controlSize('large'), frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: 4 })]} />)}</VStack>
        </BaseHost></ScrollView> : <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><HStack spacing={12}>
          <Button label={data.cancelLabel ?? ''} role="cancel" onPress={() => close(null)} modifiers={[buttonStyle('bordered'), controlSize('large')]} />
          <Button label={data.confirmLabel ?? ''} role={data.destructive ? 'destructive' : undefined} onPress={() => close('confirm')}
            modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!!data.confirmDisabled)]} />
        </HStack></BaseHost>}
      </Pressable>
    </Pressable>
  </Modal>;
}
