import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { View } from 'react-native';
import { adminText } from '../shared/localization';
import { Form, ActionRow } from './BrigaderForm';
import type { BrigaderPresentation, BrigaderPresentations } from './brigaderPresentations';
export function BrigaderDatePrompt({ entry, owner, interactive, locale }: { entry: BrigaderPresentation; owner: BrigaderPresentations; interactive: () => boolean; locale: string }) {
  const data = entry.data as { initial: number; min?: Date; max?: Date }, [draft, setDraft] = useState(() => new Date(data.initial));
  return <View><DateTimePicker value={draft} mode={entry.kind === 'date' ? 'date' : 'time'} minimumDate={data.min} maximumDate={data.max} presentation="inline" onValueChange={(_, value) => { if (interactive()) setDraft(value); }} />
    <Form><ActionRow actions={[{ label: adminText('action.cancel', locale), secondary:true, onPress:() => { if (interactive()) owner.close(entry.id); } }, { label: adminText('action.confirm', locale), onPress:() => { if (interactive()) owner.close(entry.id,draft.getTime()); } }]} /></Form>
  </View>;
}
