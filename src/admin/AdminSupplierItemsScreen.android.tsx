import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { BasicAlertDialog, Box, Button, Column, HorizontalDivider, IconButton, LoadingIndicator, OutlinedButton, RNHostView, Row, Shape, Spacer, Surface, Text, TopAppBar } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, verticalScroll, weight, width as nativeWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminSupplierItemsPageProps, AdminSupplierItemsScreenProps } from './AdminSupplierItemsScreenTypes';
import { useAdminSupplierItems, useAdminSupplierItemsConfirmation, type AdminSupplierItemsScreenModel } from './useAdminSupplierItems';

const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const rowMotion = LinearTransition.duration(220).easing(Easing.inOut(Easing.cubic));
function Icon({ name, color }: { name: 'arrow_back' | 'add' | 'remove'; color: string }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={24} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
/** @v2 ItemsTableHeader */
function TableHeader({ model }: { model: AdminSupplierItemsScreenModel }) {
  return <Row modifiers={[fillMaxWidth(), padding(12, 12, 12, 12)]}>
    <Text style={{ typography: 'bodySmall' }} modifiers={[weight(3)]}>{model.a('supplier_items.item')}</Text>
    <Text style={{ typography: 'bodySmall' }} modifiers={[weight(2)]}>{model.a('supplier_items.code')}</Text><Spacer modifiers={[nativeWidth(44)]} />
  </Row>;
}
/** @v2 ItemsTable */
export function SupplierItemsTable({ model }: { model: AdminSupplierItemsScreenModel }) {
  const { colors, mode } = useBaseTheme(), { state } = model;
  if (!state.items.length) return <BaseHost style={styles.body}><Box contentAlignment="center" modifiers={[fillMaxSize()]}>
    <Surface color={colors.surface} shape={rounded(24)} border={{ width: mode === 'dark' ? 1.35 : 1, color: colors.outlineVariant }}><Text style={{ typography: 'titleMedium' }} modifiers={[padding(18, 18, 18, 18)]}>{model.empty}</Text></Surface>
  </Box></BaseHost>;
  return <ScrollView style={styles.body}><View style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: mode === 'dark' ? 1.35 : 1 }]}>
    <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><TableHeader model={model} /></BaseHost>
    {state.items.map((item, index) => <Animated.View layout={rowMotion} key={`${item.code}:${index}`}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
        <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(12, 10, 12, 10)]}>
          <Text style={{ typography: 'bodyMedium' }} modifiers={[weight(3)]}>{item.name}</Text><Text style={{ typography: 'bodyMedium' }} modifiers={[weight(2)]}>{item.code}</Text>
          <IconButton enabled={!state.mutating} onClick={() => model.request(item)} modifiers={[size(44, 48), testID(`admin-supplier-items-action-${index}`)]}>
            <Icon name={model.mode === 'add' ? 'add' : 'remove'} color={state.mutating ? colors.onSurfaceVariant : colors.onSurface} />
          </IconButton>
        </Row><HorizontalDivider thickness={1} color={colors.outlineVariant} />
      </Column></BaseHost>
    </Animated.View>)}
  </View></ScrollView>;
}
export function SupplierItemConfirmation({ model }: { model: AdminSupplierItemsScreenModel }) {
  const host = useAdminSupplierItemsConfirmation(model), { colors } = useBaseTheme(), { width } = useWindowDimensions();
  if (!host.visible) return null;
  return <BaseHost style={styles.dialogHost}><BasicAlertDialog properties={{ usePlatformDefaultWidth: false }} onDismissRequest={() => host.choose(false)}>
    <Surface color={colors.surfaceContainerHigh} shape={rounded(28)} border={{ width: 1, color: colors.outlineVariant }} modifiers={[nativeWidth(Math.min(420, Math.max(0, width - 48)))]}>
      <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 24, 24, 20)]}>
        <Text style={{ typography: 'headlineSmall' }}>{model.a(model.mode === 'add' ? 'supplier_items.add_title' : 'supplier_items.remove_title')}</Text><Spacer modifiers={[height(10)]} />
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', lineHeight: 23.2 }}>{model.a(model.mode === 'add' ? 'supplier_items.add_message' : 'supplier_items.remove_message', { item: model.state.prompt!.item.name })}</Text><Spacer modifiers={[height(22)]} />
        <Row modifiers={[fillMaxWidth()]}><OutlinedButton onClick={() => host.choose(false)} shape={rounded(20)} colors={{ containerColor: colors.surfaceContainerLow, contentColor: colors.onSurface }}
          modifiers={[weight(1), height(56), testID('admin-supplier-items-cancel')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('bulk_move.no')}</Text></OutlinedButton><Spacer modifiers={[size(12, 1)]} />
          <Button onClick={() => host.choose(true)} shape={rounded(20)} colors={{ containerColor: colors.primaryContainer, contentColor: colors.onPrimaryContainer }}
            modifiers={[weight(1), height(56), testID('admin-supplier-items-confirm')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('bulk_move.yes')}</Text></Button>
        </Row>
      </Column>
    </Surface>
  </BasicAlertDialog></BaseHost>;
}
export function AdminSupplierItemsScreen(props: AdminSupplierItemsScreenProps) {
  const model = useAdminSupplierItems(props), { colors } = useBaseTheme(), insets = useSafeAreaInsets();
  if (!model.current() || !model.state.valid) return null;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]}>
    <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }} modifiers={[height(60)]}>
        <TopAppBar.NavigationIcon><IconButton onClick={model.back} modifiers={[semantics({ contentDescription: props.backLabel })]}><Icon name="arrow_back" color={colors.onSurface} /></IconButton></TopAppBar.NavigationIcon>
        <TopAppBar.Title><Text style={{ typography: 'titleLarge', fontSize: 24, fontWeight: '800' }}>{model.title}</Text></TopAppBar.Title>
        <TopAppBar.Actions><RNHostView matchContents><View style={styles.profile}>{props.profileAction}</View></RNHostView></TopAppBar.Actions>
      </TopAppBar><Spacer modifiers={[height(3)]} />
    </Column></BaseHost>
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-supplier-items-body-frame" contentPadding="default"><View style={styles.content}>
      {model.state.loading ? <BaseHost style={styles.body}><Box contentAlignment="center" modifiers={[fillMaxSize()]}><Box contentAlignment="center" modifiers={[size(64, 64)]}>
        <LoadingIndicator color={colors.primary} modifiers={[size(48, 48), semantics({ contentDescription: 'Loading' })]} />
      </Box></Box></BaseHost> : <SupplierItemsTable model={model} />}
    </View></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    {model.state.prompt ? <SupplierItemConfirmation key={`${model.generation}:${model.state.prompt.serial}`} model={model} /> : null}
  </View>;
}
/** @v2 AdminSupplierItemsViewScreen */
export function AdminSupplierItemsViewScreen(props: AdminSupplierItemsPageProps) { return <AdminSupplierItemsScreen {...props} mode="view" />; }
/** @v2 AdminSupplierItemsAddScreen */
export function AdminSupplierItemsAddScreen(props: AdminSupplierItemsPageProps) { return <AdminSupplierItemsScreen {...props} mode="add" />; }
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, profile: { width: 58, height: 60, justifyContent: 'center' },
  content: { flex: 1, paddingTop: 4 },
  table: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  dialogHost: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } });
