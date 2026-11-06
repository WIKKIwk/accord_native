import { BottomSheet, Button, Group, Host, HStack, List, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, interactiveDismissDisabled, keyboardType, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { preparationDisplay, type PreparationFormula } from './preparationModel';
import { preparationShareErrorMessage, preparationShareIntroduction, preparationShareSummary } from './preparationSharePresentation';
import { usePreparationText } from './PreparationUI';

function ShareField({ formula, value, busy, change }: { formula: PreparationFormula; value: string; busy: boolean; change: (value: string) => void }) {
  const nativeValue = useNativeState(value);
  return <Section><HStack><TextField text={nativeValue} placeholder={`${formula.name} shnek ulushi`}
    modifiers={[keyboardType('decimal-pad'), disabled(busy)]} onTextChange={change} /><Text>%</Text></HStack></Section>;
}

// @v2 _FormulaSharesSheet
export function PreparationSharesDialog({ formulas, materialName, close, save }: {
  formulas: PreparationFormula[]; materialName: string; close: () => void; save: (values: string[]) => Promise<void>;
}) {
  const t = usePreparationText(), { width, height } = useWindowDimensions();
  const [values, setValues] = useState(() => formulas.map(formula => formula.share_percent == null ? '' : preparationDisplay(formula.share_percent)));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), sending = useRef(false);
  const status = preparationShareSummary(values);
  const submit = async () => {
    if (!status.valid || sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try { await save(values); close(); }
    catch (failure) { setError(preparationShareErrorMessage(failure)); }
    finally { sending.current = false; setBusy(false); }
  };
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <BottomSheet isPresented onIsPresentedChange={presented => { if (!presented && !sending.current) close(); }}>
      <Group modifiers={[presentationDetents(['large']), presentationDragIndicator('visible'), interactiveDismissDisabled(busy)]}>
        <VStack spacing={12}><Text>{t('Shnek ulushlari')}</Text><Text>{preparationShareIntroduction(materialName)}</Text>
          <List>{formulas.map((formula, index) => <ShareField key={`${index}:${formula.name}`} formula={formula}
            value={values[index]} busy={busy} change={value => { setError(''); setValues(old => old.map((entry, i) => i === index ? value : entry)); }} />)}
          <Text>{status.total === null ? t('Har bir shnek uchun 0 dan katta, 100 gacha foiz kiriting') : `Jami: ${status.total}% / 100%`}</Text>
          {!!error && <Text>{error}</Text>}</List>
          <Button label={t(busy ? 'Saqlanmoqda…' : 'Saqlash')} modifiers={[disabled(!status.valid || busy)]} onPress={() => { void submit(); }} />
        </VStack>
      </Group>
    </BottomSheet>
  </Host>;
}
