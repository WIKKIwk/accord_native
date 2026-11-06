import { Button, Menu, ProgressView, Section, Text, TextField } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Alert } from 'react-native';
import type { Session } from '../auth';
import { searchMatches } from '../shared/searchNormalizer';
import { preparationAlert, usePreparationText } from './PreparationUI';
import { usePreparationInventoryAssignment } from './usePreparationInventoryAssignment';

export function PreparationInventoryAssignment({ session, barcode, allow, changed }: {
  session: Session; barcode: string; allow: boolean; changed: () => Promise<void>;
}) {
  const t = usePreparationText(), state = usePreparationInventoryAssignment(session, barcode, allow, changed), [query, setQuery] = useState('');
  const assignment = state.lookup?.assignment;
  const candidates = state.candidates.filter(item => {
    const map = item.order.map;
    return searchMatches(query, [map.id, map.code, map.order_number, map.title, map.product_code]);
  });
  const assign = (candidate: typeof candidates[number], apparatus: string) => {
    const map = candidate.order.map, label = `${map.code || map.order_number || map.id} · ${map.title || 'Buyurtma'}`;
    Alert.alert(t('Buyurtmaga ulash'), `${label} buyurtmasiga ulansinmi?`, [
      { text: t('Bekor qilish'), style: 'cancel' }, { text: t('Ulash'), onPress: () => {
        void state.assign(candidate, apparatus).then(() => Alert.alert(t('Homashyo buyurtmaga ulandi'))).catch(preparationAlert);
      } },
    ]);
  };
  return <Section title={t('Buyurtma')}>
    {state.loading && <ProgressView />}
    {!!state.error && <><Text>{state.error}</Text><Button label={t('Qayta urinish')} onPress={() => { void state.load(); }} /></>}
    {!state.loading && !state.error && assignment && <>
      <Text>{state.lookup?.order?.code || state.lookup?.order?.order_number || assignment.order_id} · {state.lookup?.order?.title ?? ''}</Text>
      {!!assignment.apparatus && <Text>{state.names[assignment.apparatus] ?? assignment.apparatus}</Text>}
      <Button label={t('Ulanishni uzish')} modifiers={[disabled(state.saving)]} onPress={() => Alert.alert(t('Homashyoni uzish'),
        t('Bu homashyoni buyurtmadan uzasizmi?'), [{ text: t('Bekor qilish'), style: 'cancel' },
          { text: t('Uzish'), style: 'destructive', onPress: () => { void state.unlink().then(() => Alert.alert(t('Homashyo buyurtmadan uzildi'))).catch(preparationAlert); } }])} />
    </>}
    {!state.loading && !state.error && !assignment && allow && <>
      {!state.candidates.length ? <Text>{t('Bu homashyoga mos faol buyurtma topilmadi')}</Text> : <>
        <TextField placeholder={t('Buyurtma qidiring')} onTextChange={setQuery} />
        <Menu label={t('Buyurtmaga ulash')} modifiers={[disabled(state.saving)]}>{candidates.map(candidate => {
          const map = candidate.order.map, label = `${map.code || map.order_number || map.id} · ${map.title || 'Buyurtma'}`;
          return candidate.apparatus_options.length === 1
            ? <Button key={map.id} label={label} onPress={() => assign(candidate, candidate.apparatus_options[0])} />
            : <Menu key={map.id} label={label}>{candidate.apparatus_options.map(option => <Button key={option}
              label={state.names[option] ?? option} onPress={() => assign(candidate, option)} />)}</Menu>;
        })}</Menu>
      </>}
    </>}
  </Section>;
}
