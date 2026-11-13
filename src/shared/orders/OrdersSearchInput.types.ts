import type { useNativeState } from '@expo/ui';
import type { ColorValue } from 'react-native';
import type { Ref } from 'react';

export type OrdersSearchInputHandle = { blur(): void };

export type OrdersSearchInputProps = {
  value: ReturnType<typeof useNativeState<string>>;
  inputRef?: Ref<OrdersSearchInputHandle>;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder: string;
  color: ColorValue;
  placeholderColor: ColorValue;
};
