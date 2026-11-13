import { BasicTextField, Box, Host, Text, type BasicTextFieldRef } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';
import { useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { OrdersSearchInputProps } from './OrdersSearchInput.types';

export function OrdersSearchInput({ value, inputRef, onChangeText, onFocus, onBlur, placeholder, color, placeholderColor }: OrdersSearchInputProps) {
  const field = useRef<BasicTextFieldRef>(null);
  useImperativeHandle(inputRef, () => ({ blur: () => { void field.current?.blur(); } }), []);
  return <Host style={styles.host}>
    <BasicTextField ref={field} value={value} onValueChange={onChangeText} singleLine
      onFocusChanged={focused => { if (focused) onFocus?.(); else onBlur?.(); }}
      keyboardOptions={{ capitalization: 'none', autoCorrectEnabled: false, imeAction: 'search' }}
      textStyle={{ color, fontSize: 15, textAlign: 'left' }} modifiers={[fillMaxWidth(), height(56)]}>
      <BasicTextField.DecorationBox>
        <Box contentAlignment="centerStart" modifiers={[fillMaxSize()]}>
          <BasicTextField.Placeholder>
            <Text color={placeholderColor} maxLines={1} softWrap={false} overflow="ellipsis"
              style={{ fontSize: 15, textAlign: 'left' }} modifiers={[fillMaxWidth()]}>{placeholder}</Text>
          </BasicTextField.Placeholder>
          <BasicTextField.InnerTextField />
        </Box>
      </BasicTextField.DecorationBox>
    </BasicTextField>
  </Host>;
}

const styles = StyleSheet.create({ host: { flex: 1, minWidth: 0, height: 56 } });
