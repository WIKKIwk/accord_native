import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationSharesDialog } from './PreparationFormulaEditor.android';
import { openPreparationFormula, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { preparationVariantNameCanSave, usePreparationLibrary } from './usePreparationLibrary';
import { usePreparationSetDetail } from './usePreparationSetDetail';
import type { preparationFormulaCatalogEntryFromJson, preparationFormulaSetFromJson } from './preparationModel';

type Recipe = ReturnType<typeof preparationFormulaCatalogEntryFromJson>;
type FormulaSet = ReturnType<typeof preparationFormulaSetFromJson>;
const recipeOptions = (recipe: Recipe) => ({ orderId: '', orderCode: '', productCode: recipe.product_code, productTitle: recipe.product_title,
  materialId: recipe.material_id, materialName: recipe.material_name, variantId: recipe.id, variantName: recipe.name,
  manageSavedFormula: true, allowAddingFormula: recipe.can_create });

function Library({ mode }: { mode: 'sets' | 'catalog' }) {
  const { session } = usePreparationContext(), state = usePreparationLibrary(session, mode), dialogs = usePreparationDialogs(), t = usePreparationText();
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { if (focused.current) void state.controller.load(); focused.current = true; }, [state.controller]));
  const renameRecipe = async (recipe: Recipe) => {
    const name = await dialogs.input({ title: 'Nomini o‘zgartirish', label: 'Formula nomi', initial: recipe.name,
      validate: value => preparationVariantNameCanSave(value, recipe.name) ? null : 'Nom kiriting' });
    if (name === null) return;
    try { await state.controller.renameRecipe(recipe, name); } catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
  };
  const renameSet = async (set: FormulaSet) => {
    const name = await dialogs.input({ title: 'Nomini o‘zgartirish', label: 'Komplekt nomi', initial: set.name });
    if (name === null) return;
    try { await state.controller.renameSet(set, name); } catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
  };
  const disabled = state.loading || state.busy;
  return <PreparationPage title={mode === 'catalog' ? 'Formulalar' : 'Mahsulot formulasi'} refreshing={state.loading}
    onRefresh={() => void state.controller.load()}>
    <PreparationField label={mode === 'catalog' ? 'Formula nomi, kodi yoki buyurtmani qidirish' : 'Kod, nom yoki buyurtmani qidirish'}
      onChange={value => state.controller.setQuery(value)} />
    {state.loading && !state.recipes.length && !state.sets.length ? <ActivityIndicator /> : null}
    {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.load()} /></> : null}
    {mode === 'catalog' ? <>
      <PreparationText title>{`${t('Barcha buyurtmalarning formulalari')}: ${state.recipes.length} ta`}</PreparationText>
      {!state.loading && !state.filteredRecipes.length ? <PreparationText>{t(state.recipes.length ? 'Formula topilmadi.' : 'Saqlangan formulalar yo‘q.')}</PreparationText> : null}
      {state.filteredRecipes.map(recipe => <PreparationRow key={`${recipe.product_code}:${recipe.material_id}:${recipe.id}`} title={recipe.name}
        subtitle={[recipe.formula_code, recipe.material_name, recipe.product_title, ...recipe.order_codes].filter(Boolean).join(' · ')} disabled={disabled}
        onPress={() => openPreparationFormula(recipeOptions(recipe))} onLongPress={() => void renameRecipe(recipe)} />)}
    </> : <>
      {!state.loading && !state.filteredSets.length ? <PreparationText>{t(state.sets.length ? 'Formula komplekti topilmadi.' : 'Saqlangan formulalar yo‘q.')}</PreparationText> : null}
      {state.filteredSets.map(set => <PreparationRow key={set.set_id} title={set.name}
        subtitle={`${set.product_title} · ${state.controller.recipeCount(set)} ta`} disabled={disabled}
        onPress={() => router.push({ pathname: '/android-preparation/set-detail', params: { data: JSON.stringify({ set, recipes: state.controller.recipesFor(set) }) } } as unknown as Href)}
        onLongPress={() => void renameSet(set)} />)}
    </>}
  </PreparationPage>;
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
  const library = usePreparationLibrary(session, 'catalog'), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [shares, setShares] = useState<FormulaSet['formulas'][number] | null>(null);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { if (focused.current) void state.controller.reload(); focused.current = true; }, [state.controller]));
  const rename = async (recipe: Recipe) => {
    const name = await dialogs.input({ title: 'Nomini o‘zgartirish', label: 'Formula nomi', initial: recipe.name,
      validate: value => preparationVariantNameCanSave(value, recipe.name) ? null : 'Nom kiriting' });
    if (name === null) return;
    try { await library.controller.renameRecipe(recipe, name); await state.controller.reload(); }
    catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
  };
  const legacy = async (entry: FormulaSet['formulas'][number]) => {
    const action = await dialogs.choose(entry.formula.name, [{ label: 'Shnek ulushlarini belgilash', value: 'shares' },
      { label: 'Tahrirlash', value: 'edit' }, { label: 'O‘chirish', value: 'delete' }]);
    if (action === 'shares') setShares(entry);
    if (action === 'edit') openPreparationFormula({ orderId: set.set_id, orderCode: set.set_id, productCode: set.product_code,
      productTitle: set.name, materialId: entry.material_id, materialName: entry.material_name, initialFormulaName: entry.formula.name,
      manageSavedFormula: true, variantId: entry.variant_id, variantName: entry.variant_name });
    if (action === 'delete' && await dialogs.confirm('Formulani o‘chirish', `«${entry.formula.name}» formulasi o‘chirilsinmi?`, 'O‘chirish')) {
      try { await state.controller.remove(entry); } catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
    }
  };
  return <><PreparationPage title={set.name} refreshing={state.busy} onRefresh={() => void state.controller.reload()}>
    <PreparationText>{t('Katalogdagi o‘zgarishlar formula keyingi safar buyurtmaga biriktirilganda olinadi.')}</PreparationText>
    {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.reload()} /></> : null}
    {!state.recipes.length && !state.legacyFormulas.length ? <PreparationText>{t('Bu komplektda formula qolmadi.')}</PreparationText> : null}
    {state.recipes.map(recipe => <PreparationRow key={`${recipe.material_id}:${recipe.id}`} title={recipe.name} subtitle={recipe.material_name}
      disabled={state.busy} onPress={() => openPreparationFormula(recipeOptions(recipe))} onLongPress={() => void rename(recipe)} />)}
    {state.legacyFormulas.map(entry => <PreparationRow key={`${entry.material_id}:${entry.variant_id}:${entry.formula.name}`}
      title={entry.formula.name} subtitle={entry.material_name} disabled={state.busy} onPress={() => void legacy(entry)} />)}
  </PreparationPage>{shares ? <PreparationSharesDialog formulas={state.controller.formulasFor(shares)}
    onSave={values => state.controller.saveShares(shares, values)} onClose={() => setShares(null)} /> : null}</>;
}
