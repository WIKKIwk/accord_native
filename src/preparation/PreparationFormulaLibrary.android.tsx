import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationFormulaDetails, type FormulaDetailAction } from './PreparationFormulaDetails.android';
import { PreparationNotice } from './PreparationNotice';
import { PreparationSharesDialog } from './PreparationFormulaEditor.android';
import { VariantNameDialog } from './PreparationVariants.android';
import { openPreparationFormula, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { usePreparationLibraryView, usePreparationReset } from './usePreparationAndroidView.android';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { usePreparationSetDetail } from './usePreparationSetDetail';
import { usePreparationNotice } from './usePreparationNotice';
import { preparationCatalogSubtitle, preparationSetSubtitle } from './preparationLibraryPresentation';
import type { preparationFormulaCatalogEntryFromJson, preparationFormulaSetFromJson } from './preparationModel';

type Recipe = ReturnType<typeof preparationFormulaCatalogEntryFromJson>;
type FormulaSet = ReturnType<typeof preparationFormulaSetFromJson>;
const recipeOptions = (recipe: Recipe) => ({ orderId: '', orderCode: '', productCode: recipe.product_code, productTitle: recipe.product_title,
  materialId: recipe.material_id, materialName: recipe.material_name, variantId: recipe.id, variantName: recipe.name, variantCode: recipe.formula_code,
  manageSavedFormula: true, allowAddingFormula: recipe.can_create });

function Library({ mode }: { mode: 'sets' | 'catalog' }) {
  const { session } = usePreparationContext(), state = usePreparationLibraryView(session, mode), dialogs = usePreparationDialogs(), t = usePreparationText();
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
  return <><View style={{ flex: 1 }}><PreparationPage title="Formulalar" drawer={mode === 'catalog'} refreshing={state.loading}
    onRefresh={() => void state.controller.load()}>
    <PreparationField label={mode === 'catalog' ? 'Formula nomi, kodi yoki buyurtmani qidirish' : 'Kod, nom yoki buyurtmani qidirish'}
      onChange={value => state.controller.setQuery(value)} />
    {state.loading && !state.recipes.length && !state.sets.length ? <ActivityIndicator /> : null}
    {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.load()} /></> : null}
    {mode === 'catalog' ? <>
      <PreparationText title>{`${t('Barcha buyurtmalarning formulalari')}: ${state.filteredRecipes.length} ta`}</PreparationText>
      {!state.loading && !state.error && !state.filteredRecipes.length ? <PreparationText>{t(state.query.trim() ? 'Formula topilmadi.' : 'Saqlangan formulalar yo‘q.')}</PreparationText> : null}
      {state.filteredRecipes.map(recipe => <PreparationRow key={`${recipe.product_code}:${recipe.material_id}:${recipe.id}`} title={recipe.name}
        subtitle={preparationCatalogSubtitle(recipe)} disabled={disabled}
        onPress={() => openPreparationFormula(recipeOptions(recipe))} onLongPress={() => actions(recipe.name, recipe.formula_code, () => { setRenameError(null); setRenameTarget(recipe); })} />)}
    </> : <>
      {!state.loading && !state.error && !state.filteredSets.length ? <PreparationText>{t(state.query.trim() ? 'Formula komplekti topilmadi.' : 'Saqlangan formulalar yo‘q.')}</PreparationText> : null}
      {state.filteredSets.map(set => <PreparationRow key={set.set_id} title={set.name}
        subtitle={preparationSetSubtitle(set, state.controller.recipeCount(set))} disabled={disabled}
        onPress={() => router.push({ pathname: '/android-preparation/set-detail', params: { data: JSON.stringify({ set, recipes: state.controller.recipesFor(set) }) } } as unknown as Href)}
        onLongPress={() => actions(set.set_id, undefined, () => { void renameSet(set); })} />)}
    </>}
  </PreparationPage><PreparationNotice message={notice.message} /></View>{renameTarget ? <VariantNameDialog initial={renameTarget.name} busy={renaming} error={renameError}
    clearError={() => setRenameError(null)} submit={name => void renameRecipe(name)} cancel={() => setRenameTarget(null)} /> : null}</>;
}

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
  usePreparationReset(state.controller);
  const library = usePreparationLibraryView(session, 'catalog'), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [shares, setShares] = useState<FormulaSet['formulas'][number] | null>(null), sheet = useNativeSheet();
  const [renameTarget, setRenameTarget] = useState<Recipe | null>(null), [renaming, setRenaming] = useState(false), [renameError, setRenameError] = useState<string | null>(null);
  const renameInFlight = useRef(false);
  const focused = useRef(false), returningFromSheet = useRef(false);
  useFocusEffect(useCallback(() => {
    if (returningFromSheet.current) { returningFromSheet.current = false; return; }
    if (focused.current) void state.controller.reload(); focused.current = true;
  }, [state.controller]));
  const rename = async (name: string) => {
    if (!renameTarget || renameInFlight.current) return;
    renameInFlight.current = true; setRenaming(true); setRenameError(null);
    try { await library.controller.renameRecipe(renameTarget, name); setRenameTarget(null); await state.controller.reload(); }
    catch (error) { setRenameError(preparationFormulaErrorMessage(error)); }
    finally { renameInFlight.current = false; setRenaming(false); }
  };
  const legacyAction = async (entry: FormulaSet['formulas'][number], action: FormulaDetailAction) => {
    if (action === 'shares') setShares(entry);
    if (action === 'edit') openPreparationFormula({ orderId: set.set_id, orderCode: set.set_id, productCode: set.product_code,
      productTitle: set.name, materialId: entry.material_id, materialName: entry.material_name, initialFormulaName: entry.formula.name,
      manageSavedFormula: true, variantId: entry.variant_id, variantName: entry.variant_name });
    if (action === 'delete' && await dialogs.confirm('Formulani o‘chirish', `«${entry.formula.name}» formulasi o‘chirilsinmi?`, 'O‘chirish')) {
      try { await state.controller.remove(entry); } catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
    }
  };
  const legacy = (entry: FormulaSet['formulas'][number]) => {
    let selected: FormulaDetailAction | null = null;
    returningFromSheet.current = true;
    sheet.open(<PreparationFormulaDetails formula={entry.formula} formulas={state.controller.formulasFor(entry)}
      materialName={entry.material_name} estimatedKg={null} onSelect={action => { selected = action; sheet.close(); }} />,
    { dismissible: true, compact: true, onDismiss: () => { if (selected) void legacyAction(entry, selected); } });
  };
  return <><PreparationPage title={set.name} refreshing={state.busy} onRefresh={() => void state.controller.reload()}>
    <PreparationText>{t('Katalogdagi o‘zgarishlar formula keyingi safar buyurtmaga biriktirilganda olinadi.')}</PreparationText>
    {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.reload()} /></> : null}
    {!state.recipes.length && !state.legacyFormulas.length ? <PreparationText>{t('Bu komplektda formula qolmadi.')}</PreparationText> : null}
    {state.recipes.map(recipe => <PreparationRow key={`${recipe.material_id}:${recipe.id}`} title={recipe.name} subtitle={recipe.material_name}
      disabled={state.busy || library.actionsBlocked} onPress={() => openPreparationFormula(recipeOptions(recipe))}
      onLongPress={() => { setRenameError(null); setRenameTarget(recipe); }} />)}
    {state.legacyFormulas.map(entry => <PreparationRow key={`${entry.material_id}:${entry.variant_id}:${entry.formula.name}`}
      title={entry.formula.name} subtitle={entry.material_name} disabled={state.busy} onPress={() => legacy(entry)} />)}
  </PreparationPage>{shares ? <PreparationSharesDialog formulas={state.controller.formulasFor(shares)} materialName={shares.material_name}
    onSave={values => state.controller.saveShares(shares, values)} onClose={() => setShares(null)} /> : null}
  {renameTarget ? <VariantNameDialog initial={renameTarget.name} busy={renaming} error={renameError}
    clearError={() => setRenameError(null)} submit={name => void rename(name)} cancel={() => setRenameTarget(null)} /> : null}</>;
}
