import { Text, type TextProps } from '@expo/ui/jetpack-compose';
import { useFonts } from 'expo-font';
import { Children, Fragment, cloneElement, createContext, createElement, isValidElement, useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { adminFontAssets, adminTextStyle } from './adminFontFamily.android';

const FontsReady = createContext(false);
export function useAdminFontsReady() { return useContext(FontsReady); }
/** Admin-owned font scope. It never changes BaseHost or another role's typography defaults. */
export function AdminTypographyProvider({ children }: { children: ReactNode }) {
  const [ready, error] = useFonts(adminFontAssets), visible = ready || error != null;
  return <FontsReady.Provider value={ready}><View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={{ flex: 1, opacity: visible ? 1 : 0 }}>{children}</View></FontsReady.Provider>;
}
// Expo's span collector recognizes its exact Text component identity. Resolve our
// nested aliases before it runs, retaining inherited weight/style and real keys.
function nativeTextChildren(children: ReactNode, inherited: TextProps['style'], ready: boolean): ReactNode {
  if (!Array.isArray(children) && !isValidElement(children)) return children;
  return Children.map(children, child => {
    if (!isValidElement<TextProps>(child)) return child;
    if (child.type === Fragment) return cloneElement(child, {}, nativeTextChildren(child.props.children, inherited, ready));
    if (child.type !== AdminText && child.type !== Text) return child;
    const { style, children: nested, ...props } = child.props;
    const semanticStyle = { ...inherited, ...adminTextStyle(style, false) };
    return createElement(Text, { ...props, key: child.key, style: adminTextStyle(semanticStyle, ready) }, nativeTextChildren(nested, semanticStyle, ready));
  });
}
/** Native Compose Text with source font/overrides; native props and nested spans remain native. */
export function AdminText({ style, children, ...props }: TextProps) {
  const ready = useContext(FontsReady), semanticStyle = adminTextStyle(style, false);
  return <Text {...props} style={adminTextStyle(semanticStyle, ready)}>{nativeTextChildren(children, semanticStyle, ready)}</Text>;
}
