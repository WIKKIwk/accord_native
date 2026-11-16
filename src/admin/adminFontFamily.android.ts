import type { TextProps } from '@expo/ui/jetpack-compose';

type TextStyle = NonNullable<TextProps['style']>;

export const adminFontNames = Object.freeze({ regular: 'AccordAdminGoogleSans-Regular', medium: 'AccordAdminGoogleSans-Medium', bold: 'AccordAdminGoogleSans-Bold',
  italic: 'AccordAdminGoogleSans-Italic', mediumItalic: 'AccordAdminGoogleSans-MediumItalic', boldItalic: 'AccordAdminGoogleSans-BoldItalic' });
// Keep explicit registered faces on pre29 Android too, where Expo's family-array API loads only its default face.
export const adminFontAssets = Object.freeze({
  [adminFontNames.regular]: require('../../assets/fonts/GoogleSans-Regular.ttf'), [adminFontNames.medium]: require('../../assets/fonts/GoogleSans-Medium.ttf'),
  [adminFontNames.bold]: require('../../assets/fonts/GoogleSans-Bold.ttf'), [adminFontNames.italic]: require('../../assets/fonts/GoogleSans-Italic.ttf'),
  [adminFontNames.mediumItalic]: require('../../assets/fonts/GoogleSans-MediumItalic.ttf'), [adminFontNames.boldItalic]: require('../../assets/fonts/GoogleSans-BoldItalic.ttf'),
});
const sourceText: Partial<Record<NonNullable<TextStyle['typography']>, TextStyle>> = {
  displaySmall: { fontSize: 34, fontWeight: '700', letterSpacing: -1 }, headlineMedium: { fontSize: 28, fontWeight: '700', letterSpacing: -.6 },
  titleLarge: { fontSize: 20, fontWeight: '700' }, titleMedium: { fontSize: 16, fontWeight: '500' }, bodyLarge: { fontSize: 16, fontWeight: '400' },
  bodyMedium: { fontSize: 14, fontWeight: '400' }, bodySmall: { fontSize: 12, fontWeight: '400' }, labelLarge: { fontSize: 16, fontWeight: '500' },
};
const standardWeights: Partial<Record<NonNullable<TextStyle['typography']>, number>> = { titleSmall: 500, labelMedium: 500, labelSmall: 500 };
/** @v2 AppTheme._textTheme */
export function adminTextStyle(style: TextStyle | undefined, fontsReady: boolean): TextStyle {
  const result: TextStyle = { ...(style?.typography ? sourceText[style.typography] : undefined), ...style };
  if (!fontsReady || result.fontFamily) return result;
  const weight = result.fontWeight === 'bold' ? 700 : result.fontWeight === 'normal' ? 400 : Number(result.fontWeight ?? (result.typography && standardWeights[result.typography]) ?? 400);
  // V2 declares static400/500/700 faces; Skia's matchStyleCSS3 selects700 for600/800/900.
  const face = weight > 500 ? 'bold' : weight >= 500 ? 'medium' : 'regular';
  result.fontFamily = result.fontStyle === 'italic' ? adminFontNames[face === 'bold' ? 'boldItalic' : face === 'medium' ? 'mediumItalic' : 'italic'] : adminFontNames[face];
  return result;
}
