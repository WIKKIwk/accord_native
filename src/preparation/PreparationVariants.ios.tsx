import { Button, ContextMenu, Host, List, ProgressView, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { PreparationVariantNameSheet } from './PreparationFormulaSheets';
import { openPreparationFormula } from './PreparationRoutes';
import { preparationReuseSubtitle, usePreparationVariants, type PreparationVariantsState } from './usePreparationVariants';

type Variant = ReturnType<typeof usePreparationVariants>['variants'][number];
function ReuseSheet({ controller, close, choose }: { controller: PreparationVariantsState; close: () => void;
  choose: (id: string) => Promise<void> }) {
  const t = usePreparationText();
  const [items, setItems] = useState<Awaited<ReturnType<PreparationVariantsState['loadReusePage']>>>([]);
  const [query, setQuery] = useState(''), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), loadingRef = useRef(false), choosing = useRef(false), active = useRef(true);
  const requestPage = useCallback((search: string, offset: number, current: number) => {
    void controller.loadReusePage(search, offset, 80).then(page => {
      if (current !== generation.current) return;
      setItems(previous => offset ? [...previous, ...page] : page); setHasMore(page.length === 80);
    }).catch(e => { if (current === generation.current) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (current === generation.current) { loadingRef.current = false; setLoading(false); } });
  }, [controller]);
  const load = (offset: number, search = query) => {
    if (offset && loadingRef.current) return;
    const current = ++generation.current;
    loadingRef.current = true;
    setLoading(true); setError('');
    if (!offset) { setItems([]); setHasMore(false); }
    requestPage(search, offset, current);
  };
  useEffect(() => {
    const counter = generation, mounted = active, isLoading = loadingRef;
    mounted.current = true; isLoading.current = true;
    requestPage('', 0, ++counter.current);
    return () => { mounted.current = false; counter.current++; };
  }, [requestPage]);
  return <Host style={{ minHeight: 400 }}><VStack><Text>{t('Shnek formulasini tanlang')}</Text>
    <TextField placeholder={t('Formula nomi, kodi yoki buyurtmani qidirish')} autoFocus modifiers={[disabled(busy)]} onTextChange={value => {
      if (value === query) return;
      setQuery(value); load(0, value);
    }} /><List>
      {loading && <ProgressView />}{!!error && <Section><Text>{error}</Text>
        <Button label={t('Qayta urinish')} modifiers={[disabled(busy || loading)]} onPress={() => load(items.length)} /></Section>}
      {!loading && !error && !items.length && <Section><Text>{t('Formula topilmadi.')}</Text></Section>}
      {items.map(item => <Button key={item.id} modifiers={[disabled(busy || loading)]} onPress={() => {
        if (choosing.current) return;
        choosing.current = true; setBusy(true); setError('');
        void choose(item.id).then(() => { if (active.current) close(); })
          .catch(e => { if (active.current) setError(e instanceof Error ? e.message : String(e)); })
          .finally(() => { choosing.current = false; if (active.current) setBusy(false); });
      }}><VStack alignment="leading"><Text>{item.name}</Text><Text>{preparationReuseSubtitle(item)}</Text></VStack></Button>)}
      {hasMore && !error && <Section><Button label={t('Yana yuklash')} modifiers={[disabled(busy || loading)]}
        onPress={() => load(items.length)} /></Section>}
    </List><Button label={t('Bekor qilish')} modifiers={[disabled(busy)]} onPress={close} /></VStack></Host>;
}

// @v2 PreparationFormulaVariantsScreen
export function PreparationVariants() {
  const params = useLocalSearchParams<{ orderId: string; orderCode: string; productCode: string; productTitle: string; materialId: string; materialName: string }>();
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const options = { orderId: params.orderId ?? '', productCode: params.productCode ?? '', materialId: params.materialId ?? '' };
  const state = usePreparationVariants(session, options), { controller } = state;
  const pending = useRef<Variant | null>(null), firstFocus = useRef(true), [opening, setOpening] = useState(false);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) firstFocus.current = false;
    else { setOpening(false); void controller.load(); }
  }, [controller]));
  const open = (variant: Variant, edit = false) => {
    setOpening(true);
    openPreparationFormula({ ...options, orderCode: params.orderCode ?? '', productTitle: params.productTitle ?? '', materialName: params.materialName ?? '',
      variantId: variant.id, variantName: variant.name, openEditorOnLoad: edit });
  };
  const afterSheet = () => {
    const variant = pending.current; pending.current = null; controller.cancelCreate(); controller.cancelReuse();
    if (variant) open(variant);
  };
  const create = async () => {
    if (!(await controller.beginCreate())) return;
    sheet.open(<PreparationVariantNameSheet close={sheet.close} save={async name => {
      const result = await controller.create(name);
      if (!result) throw new Error(controller.getSnapshot().nameError ?? 'Variant saqlanmadi');
      pending.current = result;
    }} />, { compact: true, dismissible: false, onDismiss: afterSheet });
  };
  const reuse = () => {
    if (!controller.beginReuse()) return;
    sheet.open(<ReuseSheet controller={controller} close={sheet.close} choose={async id => {
      try {
        const result = await controller.reuse(id);
        if (!result) throw new Error('Variant saqlanmadi');
        pending.current = result;
      } catch (error) { controller.beginReuse(); throw error; }
    }} />, { compact: true, dismissible: false, onDismiss: afterSheet });
  };
  const rename = (variant: Variant) => sheet.open(<PreparationVariantNameSheet initial={variant.name} close={sheet.close} save={async name => {
    if (!(await controller.rename(variant, name))) throw new Error('Variant saqlanmadi');
  }} />, { compact: true, dismissible: false });
  const remove = (variant: Variant) => Alert.alert(t('Variantni o‘chirish'), variant.name, [
    { text: t('Bekor qilish'), style: 'cancel' }, { text: t('O‘chirish'), style: 'destructive', onPress: () => { void controller.remove(variant).catch(preparationAlert); } },
  ]);
  const busy = state.loading || state.creating || state.opening || state.removing || state.copying || opening;
  return <><Stack.Screen options={{ title: t('Shnek formulalar') }} /><PreparationList refresh={() => controller.load()}>
    <PreparationStatus loading={busy} error={state.error} retry={() => { void controller.load(); }} />
    <Section>{!state.loading && !state.error && !state.variants.length && <Text>{t('Hali shnek varianti yo‘q. FAB orqali variant qo‘shing.')}</Text>}
      {state.variants.map(variant => <ContextMenu key={variant.id}><ContextMenu.Trigger>
        <Button modifiers={[disabled(busy)]} onPress={() => open(variant)}><VStack alignment="leading"><Text>{variant.name}</Text>
          <Text>{variant.formula_code} · {variant.formula_count ? `${variant.formula_count} ta ichki formula · ${t(variant.shares_complete ? 'jami 100%' : 'ulushlar belgilanmagan')}` : t('Tarkib hali kiritilmagan')}</Text></VStack></Button>
      </ContextMenu.Trigger><ContextMenu.Items><Button label={t('Tahrirlash')} modifiers={[disabled(busy)]} onPress={() => open(variant, true)} />
        <Button label={t('Nomini o‘zgartirish')} modifiers={[disabled(busy)]} onPress={() => rename(variant)} />
        <Button label={t('O‘chirish')} role="destructive" modifiers={[disabled(busy)]} onPress={() => remove(variant)} />
      </ContextMenu.Items></ContextMenu>)}
    </Section>
    <Section title={t('Amallar')}><Button label={t('Variant qo‘shish')} modifiers={[disabled(busy)]} onPress={() => { void create(); }} />
      <Button label={t('Qidirib variant qo‘shish')} modifiers={[disabled(busy)]} onPress={reuse} /></Section>
  </PreparationList></>;
}
