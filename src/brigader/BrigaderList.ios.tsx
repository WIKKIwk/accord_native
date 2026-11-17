import { Button, HStack, ProgressView, RNHostView, Text, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, cornerRadius, disabled as inactive, font, foregroundStyle, frame, onTapGesture, onLongPressGesture, padding } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import type { ReactNode } from 'react';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';

export type FeatureRowProps = { title: string; subtitle?: string; index?: number; count?: number; onPress?: () => void; onLongPress?: () => void; disabled?: boolean; trailing?: ReactNode; leading?: ReactNode };
export function FeatureRow({ title, subtitle, onPress, onLongPress, disabled, trailing, leading }: FeatureRowProps) {
  const { colors } = useBaseTheme();
  const content = <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity, minHeight: 61, alignment: 'leading' }), padding({ horizontal: 14, vertical: 8 }), background(colors.surface), cornerRadius(16)]}>{leading ? <RNHostView matchContents><View>{leading}</View></RNHostView> : null}<VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth:Infinity,alignment:'leading' })]}><Text modifiers={[font({ textStyle:'headline' }),foregroundStyle(colors.onSurface)]}>{title}</Text>{subtitle ? <Text modifiers={[font({ textStyle:'subheadline' }),foregroundStyle('secondary')]}>{subtitle}</Text> : null}</VStack>{trailing ? <RNHostView matchContents><View>{trailing}</View></RNHostView> : null}</HStack>;
  if (onLongPress) return <View style={{ paddingHorizontal:4,paddingBottom:2 }}><BaseHost matchContents={{ vertical:true }} style={{ width:'100%' }}><VStack modifiers={[inactive(!!disabled),onTapGesture(() => onPress?.()),onLongPressGesture(onLongPress)]}>{content}</VStack></BaseHost></View>;
  return <View style={{ paddingHorizontal: 4, paddingBottom: 2 }}><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Button onPress={onPress} modifiers={[buttonStyle('plain'), inactive(!!disabled), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity, minHeight: 61, alignment: 'leading' }), padding({ horizontal: 14, vertical: 8 }), background(colors.surface), cornerRadius(16)]}>
      {leading ? <RNHostView matchContents><View>{leading}</View></RNHostView> : null}<VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'headline' }), foregroundStyle(colors.onSurface)]}>{title}</Text>{subtitle ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{subtitle}</Text> : null}</VStack>
      {trailing ? <RNHostView matchContents><View>{trailing}</View></RNHostView> : null}
    </HStack>
  </Button></BaseHost></View>;
}
export function FeatureBusy() { return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><BaseHost matchContents><ProgressView /></BaseHost></View>; }
export function FeatureError({ message, retry, label }: { message: string; retry: () => void; label: string }) { return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><BaseHost matchContents><VStack spacing={12}><Text>{message}</Text><Button label={label} onPress={retry} modifiers={[buttonStyle('bordered'), frame({ minHeight: 44 })]} /></VStack></BaseHost></View>; }
