import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text as NativeText, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useNativeSheet } from '../nativeSheet';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { usePreparationContext } from './PreparationContext.android';
import { usePreparationFab } from './PreparationFab.android';
import { PreparationFormulaDetails, type FormulaDetailAction } from './PreparationFormulaDetails.android';
import { PreparationNotice } from './PreparationNotice';
import { PreparationSharesDialog } from './PreparationFormulaEditor.android';
import { VariantNameDialog } from './PreparationVariants.android';
import { openPreparationFormula, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationDock, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { usePreparationLibraryView } from './usePreparationAndroidView.android';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { usePreparationSetDetail } from './usePreparationSetDetail';
import { usePreparationNotice } from './usePreparationNotice';
import { preparationCatalogSubtitle, preparationLegacyFormulaSubtitle, preparationLegacyFormulaTitle, preparationSavedFormulaDeleteMessage,
  preparationSetRecipeSubtitle, preparationSetSubtitle, preparationSharedFormulaWarning } from './preparationLibraryPresentation';
import type { preparationFormulaCatalogEntryFromJson, preparationFormulaSetFromJson } from './preparationModel';

type Recipe = ReturnType<typeof preparationFormulaCatalogEntryFromJson>;
type FormulaSet = ReturnType<typeof preparationFormulaSetFromJson>;
const recipeOptions = (recipe: Recipe) => ({ orderId: '', orderCode: '', productCode: recipe.product_code, productTitle: recipe.product_title,
  materialId: recipe.material_id, materialName: recipe.material_name, variantId: recipe.id, variantName: recipe.name, variantCode: recipe.formula_code,
  manageSavedFormula: true, allowAddingFormula: recipe.can_create });

function LibraryRow({ title, subtitle, disabled, first, last, onPress, onLongPress }: {
  title: string; subtitle: string; disabled: boolean; first: boolean; last: boolean; onPress: () => void; onLongPress: () => void;
}) {
  const colors = useMaterialColors();
  return <WorkerQueueCard backgroundColor={colors.surface} first={first} last={last}
    onPress={disabled ? undefined : onPress} onLongPress={disabled ? undefined : onLongPress}>
    <View accessible={false} style={[styles.icon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'functions' }} size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.rowText}><NativeText style={[styles.headline, { color: colors.onSurface }]}>{title}</NativeText>
      <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{subtitle}</NativeText></View>
  </WorkerQueueCard>;
}

const passthroughListItems = () => true;

function Library({ mode }: { mode: 'sets' | 'catalog' }) {
  const { session } = usePreparationContext(), state = usePreparationLibraryView(session, mode), dialogs = usePreparationDialogs(), t = usePreparationText();
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const setDockHeight = usePreparationFab(null, { actions: [], onSelect: () => {}, enabled: false, visible: true,
    openLabel: t('Amallarni ochish'), closeLabel: t('Amallarni yopish') });
  const sheet = useNativeSheet(), notice = usePreparationNotice(), afterSheet = useRef<(() => void) | null>(null);
  const [renameTarget, setRenameTarget] = useState<Recipe | null>(null), [renaming, setRenaming] = useState(false), [renameError, setRenameError] = useState<string | null>(null);
  const renameInFlight = useRef(false);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { if (focused.current) void state.controller.load(); focused.current = true; }, [state.controller]));
  const renameRecipe = async (name: string) => {
    if (!renameTarget || renameInFlight.current) return;
    renameInFlight.current = true; setRenaming(true); setRenameError(null);
    try {
      if (!await state.controller.renameRecipe(renameTarget, name)) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
      setRenameTarget(null);
    }
    catch (error) { setRenameError(preparationFormulaErrorMessage(error)); }
    finally { renameInFlight.current = false; setRenaming(false); }
  };
  const renameSet = async (set: FormulaSet) => {
    const name = await dialogs.input({ title: 'Komplekt nomini o‘zgartirish', label: 'Komplekt nomi', initial: set.name });
    if (name === null) return;
    try { if (await state.controller.renameSet(set, name)) notice.show(t('Komplekt nomi o‘zgartirildi')); }
    catch (error) { notice.show(preparationFormulaErrorMessage(error)); }
  };
  const actions = (title: string, subtitle: string | undefined, choose: () => void) => sheet.open(
    <View style={{ padding: 16, gap: 10 }}><PreparationText title>{title}</PreparationText>{!!subtitle && <PreparationText>{subtitle}</PreparationText>}
      <PreparationRow title={t('Nomini o‘zgartirish')} onPress={() => { afterSheet.current = choose; sheet.close(); }} /></View>,
    { compact: true, dismissible: true, onDismiss: () => { const next = afterSheet.current; afterSheet.current = null; next?.(); } });
  const disabled = state.actionsBlocked;
  return <><View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersHeader search={state.query} searchPlaceholder={t('Qidirish')} onSearchChange={value => state.controller.setQuery(value)}
      onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href); }}
      onProfile={() => router.navigate('/android-preparation/profile' as Href)} />
    <OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={passthroughListItems}
      onRefresh={async () => { await state.controller.load(); }}>
    {state.loading && !state.recipes.length && !state.sets.length ? <ActivityIndicator /> : null}
    {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.load()} /></> : null}
    {mode === 'catalog' ?
      <PreparationText title>{`${t('Barcha buyurtmalarning formulalari')}: ${state.filteredRecipes.length} ta`}</PreparationText>
      : null}
    {mode === 'catalog' && !state.loading && !state.error && !state.filteredRecipes.length ? <PreparationText>{t(state.query.trim() ? 'Formula topilmadi.' : 'Saqlangan formulalar yo‘q.')}</PreparationText> : null}
    {mode === 'catalog' && state.filteredRecipes.map((recipe, index) => <LibraryRow key={`${recipe.product_code}:${recipe.material_id}:${recipe.id}`} title={recipe.name}
        subtitle={preparationCatalogSubtitle(recipe)} disabled={disabled} first={index === 0} last={index === state.filteredRecipes.length - 1}
        onPress={() => openPreparationFormula(recipeOptions(recipe))} onLongPress={() => actions(recipe.name, recipe.formula_code, () => { setRenameError(null); setRenameTarget(recipe); })} />)}
    {mode === 'sets' && !state.loading && !state.error && !state.filteredSets.length ? <PreparationText>{t(state.query.trim() ? 'Formula komplekti topilmadi.' : 'Saqlangan formulalar yo‘q.')}</PreparationText> : null}
    {mode === 'sets' && state.filteredSets.map((set, index) => <LibraryRow key={set.set_id} title={set.name}
        subtitle={preparationSetSubtitle(set, state.controller.recipeCount(set))} disabled={disabled} first={index === 0} last={index === state.filteredSets.length - 1}
        onPress={() => router.push({ pathname: '/android-preparation/set-detail', params: { data: JSON.stringify({ set, recipes: state.controller.recipesFor(set) }) } } as unknown as Href)}
        onLongPress={() => actions(set.set_id, undefined, () => { void renameSet(set); })} />)}
    </OrdersList>
    <View onLayout={event => setDockHeight(event.nativeEvent.layout.height)}><PreparationDock /></View>
    <PreparationNotice message={notice.message} /></View>{renameTarget ? <VariantNameDialog initial={renameTarget.name} busy={renaming} error={renameError}
    clearError={() => setRenameError(null)} submit={name => void renameRecipe(name)} cancel={() => setRenameTarget(null)} /> : null}</>;
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, marginStart: 16, paddingVertical: 6 },
  headline: { fontSize: 16, lineHeight: 24, includeFontPadding: false, fontWeight: '500' },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
});

// @v2 PreparationFormulaCatalogScreen
export function PreparationFormulaCatalogScreen() { return <Library mode="catalog" />; }
// @v2 PreparationFormulaOrdersScreen
export function PreparationFormulaOrdersScreen() { return <Library mode="sets" />; }

export function PreparationFormulaSetDetailScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const params = readPreparationRouteData<{ set: FormulaSet; recipes: Recipe[] }>(data);
  return params ? <SetDetail {...params} /> : <PreparationPage title="Mahsulot formulasi"><PreparationText>Formula topilmadi. Ro‘yxatni yangilang</PreparationText></PreparationPage>;
}

function SetDetail({ set, recipes }: { set: FormulaSet; recipes: Recipe[] }) {
  const { session } = usePreparationContext(), state = usePreparationSetDetail(session, set, recipes);
  const dialogs = usePreparationDialogs(), t = usePreparationText(), notice = usePreparationNotice();
  const [shares, setShares] = useState<FormulaSet['formulas'][number] | null>(null), sheet = useNativeSheet();
  const [renameTarget, setRenameTarget] = useState<Recipe | null>(null), [renaming, setRenaming] = useState(false), [renameError, setRenameError] = useState<string | null>(null);
  const renameInFlight = useRef(false);
  const focused = useRef(false), afterSheet = useRef<(() => void) | null>(null);
  useFocusEffect(useCallback(() => {
    if (focused.current) void state.controller.reload(); focused.current = true;
  }, [state.controller]));
  const rename = async (name: string) => {
    if (!renameTarget || renameInFlight.current) return;
    renameInFlight.current = true; setRenaming(true); setRenameError(null);
    try {
      if (!await state.controller.renameRecipe(renameTarget, name)) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
      setRenameTarget(null);
    }
    catch (error) { setRenameError(preparationFormulaErrorMessage(error)); }
    finally { renameInFlight.current = false; setRenaming(false); }
  };
  const legacyAction = async (entry: FormulaSet['formulas'][number], action: FormulaDetailAction) => {
    if (action === 'shares') setShares(entry);
    if (action === 'edit') openPreparationFormula({ orderId: set.set_id, orderCode: set.set_id, productCode: set.product_code,
      productTitle: set.name, materialId: entry.material_id, materialName: entry.material_name, initialFormulaName: entry.formula.name,
      manageSavedFormula: true, variantId: entry.variant_id, variantName: entry.variant_name });
    if (action === 'delete' && await dialogs.confirm('Formulani o‘chirish', preparationSavedFormulaDeleteMessage(entry.formula.name), 'O‘chirish')) {
      try { if (await state.controller.remove(entry)) notice.show(t('Formula o‘chirildi')); }
      catch (error) { notice.show(preparationFormulaErrorMessage(error)); }
    }
  };
  const legacy = (entry: FormulaSet['formulas'][number]) => {
    let selected: FormulaDetailAction | null = null;
    sheet.open(<PreparationFormulaDetails formula={entry.formula} formulas={state.controller.formulasFor(entry)}
      materialName={entry.material_name} estimatedKg={null} onSelect={action => { selected = action; sheet.close(); }} />,
    { dismissible: true, compact: true, onDismiss: () => { if (selected) void legacyAction(entry, selected); } });
  };
  const recipeActions = (recipe: Recipe) => sheet.open(<View style={{ padding: 16, gap: 10 }}>
    <PreparationText title>{recipe.name}</PreparationText>{!!recipe.formula_code && <PreparationText>{recipe.formula_code}</PreparationText>}
    <PreparationRow title={t('Nomini o‘zgartirish')} onPress={() => { afterSheet.current = () => { setRenameError(null); setRenameTarget(recipe); }; sheet.close(); }} />
  </View>, { compact: true, dismissible: true, onDismiss: () => { const next = afterSheet.current; afterSheet.current = null; next?.(); } });
  return <><View style={{ flex: 1 }}><PreparationPage title={set.name} subtitle={set.set_id} refreshing={state.busy} onRefresh={() => void state.controller.reload()}>
    <PreparationText>{t(preparationSharedFormulaWarning)}</PreparationText>
    {state.error ? <PreparationText>{state.error}</PreparationText> : null}
    {!state.recipes.length && !state.legacyFormulas.length ? <PreparationText>{t('Bu komplektda formula qolmadi.')}</PreparationText> : null}
    {state.recipes.map(recipe => <PreparationRow key={`${recipe.material_id}:${recipe.id}`} title={recipe.name} subtitle={preparationSetRecipeSubtitle(recipe)}
      disabled={state.busy} onPress={() => openPreparationFormula(recipeOptions(recipe))}
      onLongPress={() => recipeActions(recipe)} />)}
    {state.legacyFormulas.map(entry => <PreparationRow key={`${entry.material_id}:${entry.variant_id}:${entry.formula.name}`}
      title={preparationLegacyFormulaTitle(entry)} subtitle={preparationLegacyFormulaSubtitle(entry)} disabled={state.busy} onPress={() => legacy(entry)} />)}
  </PreparationPage><PreparationNotice message={notice.message} /></View>{shares ? <PreparationSharesDialog formulas={state.controller.formulasFor(shares)} materialName={shares.material_name}
    onSave={values => state.controller.saveShares(shares, values)} onClose={() => setShares(null)} /> : null}
  {renameTarget ? <VariantNameDialog initial={renameTarget.name} busy={renaming} error={renameError}
    clearError={() => setRenameError(null)} submit={name => void rename(name)} cancel={() => setRenameTarget(null)} /> : null}</>;
}
