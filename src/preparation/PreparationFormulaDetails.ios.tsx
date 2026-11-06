import { Button, Host, List, Text, VStack } from '@expo/ui/swift-ui';
import type { PreparationFormula } from './preparationModel';
import { preparationFormulaCard } from './preparationFormulaPresentation';
import { usePreparationText } from './PreparationUI';

export type FormulaDetailAction = 'shares' | 'edit' | 'delete';
export function PreparationFormulaDetails({ formula, formulas, materialName, estimatedKg, select }: {
  formula: PreparationFormula; formulas: PreparationFormula[]; materialName: string; estimatedKg: string | null;
  select: (action: FormulaDetailAction) => void;
}) {
  const t = usePreparationText(), card = preparationFormulaCard(formula, formulas, estimatedKg);
  return <Host style={{ minHeight: 300 }}><VStack><Text>{t('Formula ma’lumotlari')}</Text>
    <Text>{materialName ? `${materialName} • ${formula.name}` : formula.name}</Text><Text>{card.count}</Text><Text>{card.share}</Text><List>
      {card.lines.map((line, index) => <Text key={index}>{line}</Text>)}
    </List><Button label={t('Tahrirlash')} onPress={() => select('edit')} />
    <Button label={t('O‘chirish')} role="destructive" onPress={() => select('delete')} />
    <Button label={t('Shnek ulushlarini belgilash')} onPress={() => select('shares')} /></VStack></Host>;
}
