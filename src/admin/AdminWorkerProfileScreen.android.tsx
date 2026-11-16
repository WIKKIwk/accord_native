import { Box, Button, CircularProgressIndicator, Column, HorizontalDivider, IconButton, RNHostView, Shape, Spacer, Surface, Text, TopAppBar } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height, padding, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkerProfileScreenProps } from './AdminWorkerProfileScreenTypes';
import type { AdminWorkerProfileCard } from './adminWorkerProfilePresentation';
import { useAdminWorkerProfile } from './useAdminWorkerProfile';

const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
/** @v2 _InfoCard and _InfoLine */
export function WorkerProfileInfoCard({ card }: { card: AdminWorkerProfileCard }) {
  const { colors } = useBaseTheme(); return <BaseHost matchContents={{ vertical: true }} style={styles.card}>
    <Surface color={colors.surface} shape={rounded(16)} border={{ width: 1, color: `${colors.outlineVariant.slice(0, 7)}B3` }} modifiers={[fillMaxWidth()]}>
      <Column modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>{card.title}</Text><Spacer modifiers={[height(12)]} />
        {card.rows.map((row, index) => <Column key={index} modifiers={[fillMaxWidth()]}>
          {index ? <Box contentAlignment="center" modifiers={[fillMaxWidth(), height(18)]}><HorizontalDivider /></Box> : null}
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{row.label}</Text><Spacer modifiers={[height(4)]} /><Text style={{ fontSize: 14, fontWeight: '700' }}>{row.value}</Text>
        </Column>)}
      </Column>
    </Surface>
  </BaseHost>;
}
/** @v2 AdminWorkerProfileDetailScreen */
export function AdminWorkerProfileScreen(props: AdminWorkerProfileScreenProps) {
  const model = useAdminWorkerProfile(props), { colors } = useBaseTheme(), insets = useSafeAreaInsets(); if (!model.current() || !model.state.valid) return null;
  return <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.surfaceContainerHigh }]}>
    <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }} modifiers={[height(60)]}>
        <TopAppBar.NavigationIcon><IconButton onClick={model.back} modifiers={[semantics({ contentDescription: props.backLabel })]}><RNHostView matchContents><SymbolView name={{ android: 'arrow_back' }} size={24} tintColor={colors.onSurface} /></RNHostView></IconButton></TopAppBar.NavigationIcon>
        <TopAppBar.Title><Text style={{ fontSize: 24, fontWeight: '800' }}>{model.title}</Text></TopAppBar.Title>
        <TopAppBar.Actions><RNHostView matchContents><View style={styles.profile}>{props.profileAction}</View></RNHostView></TopAppBar.Actions>
      </TopAppBar><Spacer modifiers={[height(3)]} />
    </Column></BaseHost>
    <View style={[styles.body, { backgroundColor: colors.surfaceContainerLow }]}>
      {model.state.phase === 'content' ? <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void model.reload(); }} tintColor={colors.primary} colors={[colors.primary]} />}>
        {model.cards.map((card, index) => <WorkerProfileInfoCard key={index} card={card} />)}
      </ScrollView> : <BaseHost style={styles.screen}><Box contentAlignment="center" modifiers={[fillMaxSize()]}>
        {model.state.phase === 'loading' ? <CircularProgressIndicator /> : <Button onClick={() => { void model.reload(); }} shape={rounded(20)} modifiers={[height(56), testID('admin-worker-profile-retry')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.retryLabel}</Text></Button>}
      </Box></BaseHost>}
    </View><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, fullWidth: { width: '100%' }, profile: { width: 58, height: 60, justifyContent: 'center' },
  body: { flex: 1, marginHorizontal: 6, borderRadius: 18, overflow: 'hidden' }, content: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 116 }, card: { width: '100%', marginBottom: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
