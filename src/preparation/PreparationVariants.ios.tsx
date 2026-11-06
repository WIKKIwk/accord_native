import { Button, Host, List, ProgressView, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationList, PreparationStatus, usePreparationText } from './PreparationUI';
import { PreparationVariantNameDialog } from './PreparationVariantNameDialog';
import { PreparationNotice } from './PreparationNotice';
import { openPreparationFormula } from './PreparationRoutes';
import { preparationReuseSubtitle, usePreparationVariants, type PreparationVariantsState } from './usePreparationVariants';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { preparationVariantRemoveMessage, preparationVariantRemovedMessage, preparationVariantSubtitle } from './preparationVariantPresentation';
import { usePreparationNotice } from './usePreparationNotice';

type Variant = ReturnType<typeof usePreparationVariants>['variants'][number];
type VariantAction = 'edit' | 'delete' | 'rename';

function VariantRow({ variant, busy, open, actions }: { variant: Variant; busy: boolean; open: () => void; actions: () => void }) {
  return <Button modifiers={[disabled(busy), onLongPressGesture(actions)]} onPress={open}>
    <VStack alignment="leading"><Text>{variant.name}</Text><Text>{preparationVariantSubtitle(variant)}</Text></VStack>
  </Button>;
}

function VariantActions({ variant, choose }: { variant: Variant; choose: (action: VariantAction) => void }) {
  const t = usePreparationText();
  return <Host matchContents={{ vertical: true }}><VStack spacing={12}>
    <Text>{variant.name}</Text>{!!variant.formula_code && <Text>{variant.formula_code}</Text>}
    <Button label={t('Tahrirlash')} onPress={() => choose('edit')} />
    <Button label={t('O‘chirish')} role="destructive" onPress={() => choose('delete')} />
    <Button label={t('Nomini o‘zgartirish')} onPress={() => choose('rename')} />
  </VStack></Host>;
}

function ReuseSheet({ controller, choose }: { controller: PreparationVariantsState; choose: (id: string) => void }) {
  const t = usePreparationText();
  const [items, setItems] = useState<Awaited<ReturnType<PreparationVariantsState['loadReusePage']>>>([]);
  const [query, setQuery] = useState(''), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const generation = useRef(0), loadingRef = useRef(false), latestQuery = useRef('');
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
    const counter = generation, isLoading = loadingRef;
    isLoading.current = true;
    requestPage('', 0, ++counter.current);
    return () => { counter.current++; };
  }, [requestPage]);
  return <Host style={{ minHeight: 400 }}><VStack><Text>{t('Shnek formulasini tanlang')}</Text>
    <TextField placeholder={t('Formula nomi, kodi yoki buyurtmani qidirish')} autoFocus onTextChange={value => {
      if (value === latestQuery.current) return;
      latestQuery.current = value; setQuery(value); load(0, value);
    }} /><List>
      {loading && <ProgressView />}{!!error && <Section><Text>{error}</Text>
        <Button label={t('Qayta urinish')} modifiers={[disabled(loading)]} onPress={() => load(items.length)} /></Section>}
      {!loading && !error && !items.length && <Section><Text>{t('Formula topilmadi.')}</Text></Section>}
      {items.map(item => <Button key={item.id} modifiers={[disabled(loading)]} onPress={() => choose(item.id)}>
        <VStack alignment="leading"><Text>{item.name}</Text><Text>{preparationReuseSubtitle(item)}</Text></VStack></Button>)}
      {hasMore && !error && <Section><Button label={t('Yana yuklash')} modifiers={[disabled(loading)]}
        onPress={() => load(items.length)} /></Section>}
    </List></VStack></Host>;
}

// @v2 PreparationFormulaVariantsScreen
export function PreparationVariants() {
  const params = useLocalSearchParams<{ orderId: string; orderCode: string; productCode: string; productTitle: string; materialId: string; materialName: string; customerName?: string }>();
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet(), actionSheet = useNativeSheet(), notice = usePreparationNotice();
  const options = { orderId: params.orderId ?? '', productCode: params.productCode ?? '', materialId: params.materialId ?? '' };
  const state = usePreparationVariants(session, options), { controller } = state;
  const pendingReuse = useRef<string | null>(null), afterAction = useRef<(() => void) | null>(null), firstFocus = useRef(true);
  const [opening, setOpening] = useState(false), [nameDialog, setNameDialog] = useState<'create' | Variant | null>(null);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) firstFocus.current = false;
    else { setOpening(false); void controller.load(); }
  }, [controller]));
  const open = (variant: Variant, edit = false) => {
    setOpening(true);
    openPreparationFormula({ ...options, orderCode: params.orderCode ?? '', productTitle: params.productTitle ?? '', materialName: params.materialName ?? '',
      customerName: params.customerName, variantId: variant.id, variantName: variant.name, variantCode: variant.formula_code, openEditorOnLoad: edit });
  };
  const create = async () => {
    if (!(await controller.beginCreate())) return;
    setNameDialog('create');
  };
  const reuse = () => {
    if (!controller.beginReuse()) return;
    sheet.open(<ReuseSheet controller={controller} choose={id => { pendingReuse.current = id; sheet.close(); }} />,
      { compact: true, dismissible: true, onDismiss: () => {
        const id = pendingReuse.current; pendingReuse.current = null;
        if (!id) { controller.cancelReuse(); return; }
        void controller.reuse(id).then(variant => { if (variant) open(variant); })
          .catch(error => notice.show(preparationFormulaErrorMessage(error)));
      } });
  };
  const remove = (variant: Variant) => Alert.alert(t('Shnek formulasini olib tashlash'), preparationVariantRemoveMessage(variant.name, params.orderCode ?? ''), [
    { text: t('Bekor qilish'), style: 'cancel' }, { text: t('O‘chirish'), style: 'destructive', onPress: () => {
      void controller.remove(variant).then(removed => { if (removed) notice.show(preparationVariantRemovedMessage(variant.name)); })
        .catch(error => notice.show(preparationFormulaErrorMessage(error)));
    } },
  ]);
  const busy = state.loading || state.creating || state.opening || state.removing || state.copying || opening;
  const actions = (variant: Variant) => {
    if (busy) return;
    actionSheet.open(<VariantActions variant={variant} choose={action => {
      afterAction.current = () => {
        if (action === 'edit') open(variant, true);
        else if (action === 'delete') remove(variant);
        else setNameDialog(variant);
      };
      actionSheet.close();
    }} />, { compact: true, dismissible: true, onDismiss: () => {
      const next = afterAction.current; afterAction.current = null; next?.();
    } });
  };
  const nameTarget = nameDialog;
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Shnek formulalar') }} /><PreparationList refresh={() => controller.load()}>
    <PreparationStatus loading={busy} error={state.error} retry={() => { void controller.load(); }} />
    <Section><Text>{`${params.materialName ?? ''} • ${params.orderCode ?? ''}`}</Text>
      <Text>{`${params.orderCode ?? ''} • ${params.productTitle ?? ''}`}</Text></Section>
    <Section>{!state.loading && !state.error && !state.variants.length && <Text>{t('Hali shnek varianti yo‘q. FAB orqali variant qo‘shing.')}</Text>}
      {state.variants.map(variant => <VariantRow key={variant.id} variant={variant} busy={busy}
        open={() => open(variant)} actions={() => actions(variant)} />)}
    </Section>
    <Section title={t('Amallar')}><Button label={t('Variant qo‘shish')} modifiers={[disabled(busy)]} onPress={() => { void create(); }} />
      <Button label={t('Qidirib variant qo‘shish')} modifiers={[disabled(busy)]} onPress={reuse} /></Section>
  </PreparationList><PreparationNotice message={notice.message} />
    {nameTarget && <PreparationVariantNameDialog<Variant> initial={nameTarget === 'create' ? undefined : nameTarget.name} orderScoped
      save={async name => {
        if (nameTarget === 'create') {
          const result = await controller.create(name);
          if (!result) throw new Error(controller.getSnapshot().nameError ?? 'Akkaunt o‘zgargan. Sahifani qayta oching');
          return result;
        }
        try {
          const result = await controller.rename(nameTarget, name);
          if (!result) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
          return result;
        } catch (error) { throw new Error(preparationFormulaErrorMessage(error)); }
      }} finish={variant => {
        setNameDialog(null);
        if (nameTarget === 'create') { controller.cancelCreate(); if (variant) open(variant); }
      }} />}
  </View>;
}
