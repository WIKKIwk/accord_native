import { Button, Host, RNHostView, Row, Text } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { useWorkerColors } from './useWorkerColors';

export type WorkerSheetIcon = ComponentProps<typeof SymbolView>['name'];
type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'text' | 'filled' | 'outlined';
  height?: number;
  icon?: WorkerSheetIcon;
  largeLabel?: boolean;
  /** Semantic tint for the native iOS order-sheet controls. */
  orderAction?: 'start' | 'resume' | 'pause' | 'complete' | 'report';
};

export function WorkerSheetButton({ label, onPress, disabled, variant = 'outlined', height, icon, largeLabel }: Props) {
  const colors = useWorkerColors();
  const dark = useColorScheme() === 'dark';
  const iconColor = variant === 'filled' ? (dark ? '#162b21' : '#fff') : colors.icon;
  return <Host matchContents={{ vertical: true }} style={styles.host}>
    <Button label={label} onPress={onPress} disabled={disabled} variant={variant} style={height ? { height } : undefined}>
      {icon || largeLabel ? <Row spacing={8} alignment="center">
        {icon && <RNHostView matchContents><SymbolView name={icon} size={20} tintColor={iconColor} /></RNHostView>}
        <Text textStyle={largeLabel ? { fontSize: 22, fontWeight: '600' } : undefined}>{label}</Text>
      </Row> : undefined}
    </Button>
  </Host>;
}

const styles = StyleSheet.create({ host: { width: '100%' } });
