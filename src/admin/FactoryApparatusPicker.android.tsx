import { useSyncExternalStore } from 'react';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent.android';
import type { FactoryApparatusPickerProps } from './factoryApparatusPickerTypes';
import { useFactoryApparatusPicker } from './useFactoryApparatusPicker';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

export function FactoryApparatusPicker(props: FactoryApparatusPickerProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const picker = useFactoryApparatusPicker(props, locale);
  const items = picker.rows.map(row => {
    if (row.kind === 'heading') return { key: row.key, title: row.title, heading: true as const };
    const { id, name } = row.item;
    return { key: row.key, title: name, selected: picker.selected.has(id), select: () => picker.toggle(id) };
  });
  return <PickerSheetContent title={picker.text.title} hint={picker.text.search} emptyLabel={picker.text.empty}
    closeLabel={localizedGetter('closeAction', locale)} onClose={props.onCancel} onSearch={picker.setQuery} items={items} showSelectionIndicator
    footerAction={<WorkerSheetButton variant="filled" icon={{ android: 'check' }} label={picker.text.confirm} onPress={picker.confirm} />} />;
}
