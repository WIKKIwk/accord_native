import { useState } from 'react';
import { ScrollView } from 'react-native';
import { adminText } from '../shared/localization';
import { Form, Label, Action, ActionRow, Gap } from './BrigaderForm';
import { CalculateField } from './BrigaderCalculateNative';
import { BrigaderAsyncPicker } from './BrigaderAsyncPicker';
import { BrigaderSurfaceHeader } from './BrigaderSurfaceHeader';
import { FeatureRow } from './BrigaderList';
import { BrigaderOrderConfirmation } from './BrigaderOrderConfirmation';
import type { BrigaderPresentations, BrigaderPresentation } from './brigaderPresentations';
export function BrigaderCalculateDialog({ entry, owner, interactive, locale }: {
    entry: BrigaderPresentation;
    owner: BrigaderPresentations;
    interactive: () => boolean;
    locale: string;
}) {
    const [name, setName] = useState(''), [submitted, setSubmitted] = useState(false), [error, setError] = useState(''), a = (key: string) => adminText(key, locale), close = (result?: unknown) => { if (interactive())
        owner.close(entry.id, result); };
    if (entry.kind === 'calculatePicker')
        return <BrigaderAsyncPicker entry={entry} owner={owner} interactive={interactive} locale={locale}/>;
    if (entry.kind === 'orderConfirm')
        return <BrigaderOrderConfirmation locale={locale} close={close}/>;
    if (entry.kind === 'calculateChoice') {
        const data = entry.data as {
            title: string;
            selected: string;
            options: string[];
        };
        return <><BrigaderSurfaceHeader title={data.title} closeLabel={a('action.close')} onClose={() => close()}/>{data.options.map((option, index) => <FeatureRow key={option} title={option} index={index} count={data.options.length} subtitle={data.selected === option ? '✓' : undefined} onPress={() => close(option)}/>)}</>;
    }
    if (entry.kind === 'comboName')
        return <Form><Label>{a('calculate.combo_name_title')}</Label><Label>{a('calculate.combo_name_hint')}</Label><CalculateField autofocus maxLength={160} label={a('calculate.combo_name')} value={name} onChange={value => { if (interactive())
            setName(value); }} error={error}/><ActionRow actions={[{ label: a('action.cancel'), secondary: true, disabled: submitted, onPress: () => { if (!submitted) {
                    setSubmitted(true);
                    close();
                } } }, { label: a('action.save'), disabled: submitted, onPress: () => { if (!interactive() || submitted)
                    return; if (!name.trim()) {
                    setError(a('calculate.combo_name_required'));
                    return;
                } setSubmitted(true); close(name.trim()); } }]}/></Form>;
    if (entry.kind === 'quickRecreate')
        return <Form><Label>{a('calculate.quick_order_exists')}</Label><Gap size={14}/><Label>{a('calculate.recreate_question')}</Label><Gap size={26}/><ActionRow actions={[{ label: a('calculate.no'), secondary: true, onPress: () => close('cancel') }, { label: a('calculate.yes'), onPress: () => close('recreate') }]}/><Gap size={20}/><Label>{a('calculate.use_template_question')}</Label><Action label={a('calculate.use_template')} onPress={() => close('useTemplate')}/></Form>;
    if (entry.kind === 'orderConfirm')
        return <><BrigaderSurfaceHeader title={a('calculate.order_open')} closeLabel={a('action.close')} onClose={() => close()}/><Form><Label>{a('calculate.order_open_confirmation')}</Label><Gap size={20}/><ActionRow actions={[{ label: 'Bekor qilish', secondary: true, onPress: () => close(false) }, { label: 'Tasdiqlash', onPress: () => close(true) }]}/></Form></>;
    if (entry.kind === 'openedOrderError') {
        const data = entry.data as {
            reason: string;
            orderNumber: string;
        };
        return <ScrollView><Form><Label>{'Saqlash tasdiqlanmadi'}</Label>{data.orderNumber.trim() ? <Label>{`Buyurtma №${data.orderNumber.trim()}`}</Label> : null}<Label>{'Sabab'}</Label><Label>{data.reason}</Label><Label>{'Kiritgan ma’lumotlaringiz shu oynada saqlanib turibdi.'}</Label><Action label="Tushunarli" onPress={() => close()}/></Form></ScrollView>;
    }
    return null;
}
