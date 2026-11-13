import { Host, TextInput, type TextInputRef } from '@expo/ui';
import { useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { OrdersSearchInputProps } from './OrdersSearchInput.types';

export function OrdersSearchInput({ value, inputRef, onChangeText, onFocus, onBlur, placeholder, color, placeholderColor }: OrdersSearchInputProps) {
  const field = useRef<TextInputRef>(null);
  useImperativeHandle(inputRef, () => ({ blur: () => field.current?.blur() }), []);
  return <Host colorScheme="light" matchContents={{ vertical: true }} style={styles.host}>
    <TextInput ref={field} value={value} onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur}
      placeholder={placeholder} placeholderTextColor={placeholderColor} textAlign="left"
      textStyle={{ color: typeof color === 'string' ? color : undefined, fontSize: 15 }}
      style={{ width: '100%' }} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
  </Host>;
}

const styles = StyleSheet.create({ host: { flex: 1, minWidth: 0 } });
