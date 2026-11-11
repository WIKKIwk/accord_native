import type { ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AuthBackground } from './AuthBackground';
import { useBaseTheme } from './useBaseTheme';
import { useWelcomeTransition, type WelcomeCopy } from './useWelcomeTransition';

export type WelcomeScreenProps = WelcomeCopy & {
  onLanguage: () => void;
  onTheme: () => void;
  onStart: () => void;
};

export function WelcomeLayout({ content, children }: { content: WelcomeCopy; children: (copy: WelcomeCopy, opacity: Animated.Value) => ReactNode }) {
  const { colors, direction } = useBaseTheme();
  const { width } = useWindowDimensions();
  const { copy, opacity, translateX } = useWelcomeTransition(content);
  return <View style={styles.page}>
    <AuthBackground />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.body}>
        <Animated.Text accessibilityRole="header" style={[styles.headline, { color: colors.onSurface, fontSize: width < 360 ? 40 : 46,
          textAlign: direction === 'rightToLeft' ? 'right' : 'left', opacity, transform: [{ translateX }] }]}>{copy.headline}</Animated.Text>
        {children(copy, opacity)}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 100, paddingBottom: 32 },
  body: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  headline: { fontWeight: '400', letterSpacing: -1.5, lineHeight: 50, minHeight: 150, marginBottom: 28 },
});
