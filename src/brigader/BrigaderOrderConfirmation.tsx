import { adminText } from '../shared/localization';
import { Form, Label, Gap, ActionRow } from './BrigaderForm';
import { BrigaderSurfaceHeader } from './BrigaderSurfaceHeader';
/** Source _ProductionMapOrderConfirmationDialog, after actual native dismissal. */
export function BrigaderOrderConfirmation({ locale, close }: {
    locale: string;
    close: (result?: boolean) => void;
}) { const a = (key: string) => adminText(key, locale); return <><BrigaderSurfaceHeader title={a('calculate.order_open')} closeLabel={a('action.close')} onClose={() => close()}/><Form><Label>{a('calculate.order_open_confirmation')}</Label><Gap size={20}/><ActionRow actions={[{ label: 'Bekor qilish', secondary: true, onPress: () => close(false) }, { label: 'Tasdiqlash', onPress: () => close(true) }]}/></Form></>; }
