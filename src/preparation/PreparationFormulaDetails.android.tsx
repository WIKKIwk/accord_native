import { View } from 'react-native';
import type { PreparationFormula } from './preparationModel';
import { preparationFormulaPresentation } from './preparationNavigation.android';
import { PreparationButton, PreparationRow, PreparationText, usePreparationText } from './PreparationUI.android';

export type FormulaDetailAction = 'shares' | 'edit' | 'delete';
export function PreparationFormulaDetails({ formula, formulas, materialName, estimatedKg, onSelect }: {
  formula: PreparationFormula; formulas: PreparationFormula[]; materialName: string; estimatedKg: string | null;
  onSelect: (action: FormulaDetailAction) => void;
}) {
  const t = usePreparationText();
  return <View style={{ padding: 16, gap: 10 }}>
    <PreparationText title>{t('Formula ma’lumotlari')}</PreparationText>
    <PreparationRow title={[materialName, formula.name].filter(Boolean).join(' · ')}
      subtitle={preparationFormulaPresentation(formula, formulas, estimatedKg)} />
    <PreparationButton label="Shnek ulushlarini belgilash" onPress={() => onSelect('shares')} />
    <PreparationButton label="Tahrirlash" onPress={() => onSelect('edit')} />
    <PreparationButton label="O‘chirish" onPress={() => onSelect('delete')} />
  </View>;
}
