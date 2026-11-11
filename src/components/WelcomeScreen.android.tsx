import { Button, Row, Text } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { Animated, StyleSheet, Text as RNText, View } from 'react-native';
import { BaseHost as Host } from './BaseHost';
import { WorkerQueueCard } from './WorkerQueueCard.android';
import { WelcomeLayout, type WelcomeScreenProps } from './WelcomeLayout';
import { useBaseTheme } from './useBaseTheme';

// @v2 WelcomeScreen
export function WelcomeScreen(props: WelcomeScreenProps) {
  const { colors, direction } = useBaseTheme();
  return <WelcomeLayout content={props}>{(copy, opacity) => <>
    <View style={styles.list}>
      {[
        { id: 'welcome-language', label: copy.languageLabel, value: copy.languageValue, onPress: props.onLanguage },
        { id: 'welcome-theme', label: copy.themeLabel, value: copy.themeValue, onPress: props.onTheme },
      ].map((item, index) => <WorkerQueueCard key={item.id} backgroundColor={colors.surface} first={index === 0} last={index === 1} onPress={item.onPress}>
        <View testID={item.id} style={[styles.row, { flexDirection: direction === 'rightToLeft' ? 'row-reverse' : 'row' }]}>
          <Animated.Text style={[styles.label, { color: colors.onSurface, opacity }]}>{item.label}</Animated.Text>
          <Animated.Text style={[styles.value, { color: colors.onSurfaceVariant, opacity, textAlign: direction === 'rightToLeft' ? 'left' : 'right' }]}>{item.value}</Animated.Text>
          <RNText style={[styles.chevron, { color: colors.onSurfaceVariant }]}>{direction === 'rightToLeft' ? '‹' : '›'}</RNText>
        </View>
      </WorkerQueueCard>)}
    </View>
    <Animated.View style={{ paddingTop: 28, opacity }}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <Row modifiers={[fillMaxWidth()]} horizontalArrangement="end">
          <Button onClick={props.onStart} contentPadding={{ start: 28, end: 28 }}
            modifiers={[defaultMinSize({ minWidth: 148, minHeight: 54 }), testID('welcome-start')]}>
            <Text style={{ fontSize: 18, fontWeight: '600' }}>{copy.startLabel}</Text>
          </Button>
        </Row>
      </Host>
    </Animated.View>
  </>}</WelcomeLayout>;
}

const styles = StyleSheet.create({
  list: { marginHorizontal: -8 },
  row: { flex: 1, alignItems: 'center', gap: 16, paddingHorizontal: 8, paddingVertical: 10 },
  label: { flex: 1, fontSize: 20, lineHeight: 26 },
  value: { flex: 1, fontSize: 15, lineHeight: 22 },
  chevron: { fontSize: 24, lineHeight: 28 },
});
