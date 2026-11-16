import type { TextFieldTextStyle } from '@expo/ui/jetpack-compose';
import { adminTextStyle } from './adminFontFamily.android';

/** The editable buffer has its own native style, separate from placeholder Text. */
export function adminInputTextStyle(style: TextFieldTextStyle | undefined, fontsReady: boolean): TextFieldTextStyle | undefined {
  if (!fontsReady || style?.fontFamily) return style;
  return { ...style, fontFamily: adminTextStyle(style, true).fontFamily };
}
