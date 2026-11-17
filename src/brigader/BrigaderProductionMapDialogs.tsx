import { Fragment, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import type { AdminApparatus } from '../apparatusApi';
import type { ProductionMapDraftNode as Node } from '../admin/productionMapDraftModel';
import type { CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
import { Form, Field, Label, Action, ChoiceChips } from './BrigaderForm';
import { CalculateField, CalculatePicker, CalculateAction } from './BrigaderCalculateNative';
import { FeatureRow } from './BrigaderList';
import { BrigaderSurfaceHeader } from './BrigaderSurfaceHeader';
import { BrigaderOrderConfirmation } from './BrigaderOrderConfirmation';
import { BrigaderAsyncPicker } from './BrigaderAsyncPicker';
import type { BrigaderPresentation, BrigaderPresentations } from './brigaderPresentations';
import { productionFormulaDisplay, productionFormulaInternal, productionFormulaVariables, productionFormulaInsert, productionFormulaSuggestion } from './productionFormulaEditor';
import { productionGroupLabel } from './productionMapGroupLabel';
function FormulaEditor({ data, interactive, close }: {
    data: {
        title: string;
        expression: string;
    };
    interactive: () => boolean;
    close: (result?: unknown) => void;
}) { const [text, setText] = useState(() => productionFormulaDisplay(data.expression)), [cursor, setCursor] = useState(text.length), [version, setVersion] = useState(0), [focus, setFocus] = useState(1), suggestion = productionFormulaSuggestion(text, cursor), insert = (variable: typeof productionFormulaVariables[number], space = false) => { if (!interactive())
    return; const value = productionFormulaInsert(text, cursor, variable, space); setText(value.text); setCursor(value.cursor); setVersion(value => value + 1); }; return <Form><Label>{`${data.title} yozish`}</Label><CalculateField autofocus multiline minHeight={170} label={data.title} value={text} onChange={value => { if (interactive())
    setText(value); }} selection={cursor} selectionVersion={version} onSelectionChange={selection => { if (interactive())
    setCursor(selection.start); }} focusVersion={focus} onSubmit={() => { if (!interactive())
    return; if (suggestion && cursor === text.length)
    insert(suggestion, true); setFocus(value => value + 1); }}/><ChoiceChips options={productionFormulaVariables.map(variable => ({ label: variable.label, selected: false, onChange: () => insert(variable) }))}/><Action label="Saqlash" onPress={() => close(productionFormulaInternal(text.trim()))}/></Form>; }
function NodeEditor({ node, owner, interactive, close }: {
    node: Node;
    owner: BrigaderPresentations;
    interactive: () => boolean;
    close: (value?: unknown) => void;
}) { const [title, setTitle] = useState(node.title), [role, setRole] = useState(node.role_code), [target, setTarget] = useState(node.formula?.target ?? ''), [expression, setExpression] = useState(node.formula?.expression ?? ''), formula = node.kind === 'formula' || node.kind === 'condition'; return <Form><Label>{'Node sozlash'}</Label><Field label="Nomi" value={title} onChange={value => { if (interactive())
    setTitle(value); }}/>{node.kind === 'task' ? <Field label="Vazifa / role code" value={role} onChange={value => { if (interactive())
    setRole(value); }}/> : null}{node.kind === 'formula' ? <Field label="Formula target" value={target} onChange={value => { if (interactive())
    setTarget(value); }}/> : null}{formula ? <CalculatePicker label={node.kind === 'condition' ? 'Shart' : 'Formula'} value={productionFormulaDisplay(expression) || ' '} onPress={() => { if (!interactive())
    return; void owner.request<string>('graphFormula', { title: node.kind === 'condition' ? 'Shart' : 'Formula', expression }).then(value => { if (value !== undefined && interactive())
    setExpression(value); }); }}/> : null}<Action label="Saqlash" onPress={() => close({ ...node, title: title.trim() || node.title, role_code: role.trim(), formula: formula ? { target: node.kind === 'condition' ? '' : target.trim() || 'result', expression: expression.trim() || node.formula?.expression || 'order_qty' } : null })}/></Form>; }
function RezkaEditor({ data, interactive, close }: {
    data: {
        node: Node;
        frames: number;
        products: CalculateOrderTemplate['products'];
    };
    interactive: () => boolean;
    close: (value?: unknown) => void;
}) { const [title, setTitle] = useState(data.node.title), [groups, setGroups] = useState(() => data.node.rezka_frame_groups.length ? [...data.node.rezka_frame_groups] : Array.from({ length: data.frames }, () => 1)), valid = data.frames > 0 && groups.length > 0 && groups.every(value => value > 0) && groups.reduce((a, b) => a + b, 0) === data.frames, lanes = data.products.flatMap(product => Array.from({ length: product.frame_count }, () => product)); let cursor = 1; return <Form><Label>{'Rezka sozlash'}</Label><Field label="Nomi" value={title} onChange={value => { if (interactive())
    setTitle(value); }}/>{data.frames <= 0 ? <Label>{'Buyurtmada kadr soni topilmadi. Avval buyurtma hisob-kitobida kadr sonini belgilang.'}</Label> : !valid ? <Label>{'Saqlangan kadr guruhlari kadr soniga mos emas. Rezka sozlamasini qayta yarating.'}</Label> : groups.map((count, index) => { const start = cursor, end = cursor + count - 1; cursor = end + 1; const part = lanes.slice(start - 1, end), width = part.reduce((sum, product) => sum + product.frame_product_size_mm, 0), label = lanes.length >= end ? `${[...new Set(part.map(product => product.product))].join(' + ')} · ${Number.isInteger(width) ? width.toFixed(1) : width} mm` : start === end ? `Kadr ${start}` : `Kadr ${start}-${end}`; return <Fragment key={index}><CalculateAction label={label} secondary={count === 1} disabled={count <= 1} height={48} onPress={() => { if (interactive())
    setGroups(previous => previous.flatMap((value, i) => i === index ? Array.from({ length: value }, () => 1) : [value])); }}/>{index < groups.length - 1 ? <CalculateAction label="Jipslash" secondary height={44} onPress={() => { if (interactive())
    setGroups(previous => { const next = [...previous]; next.splice(index, 2, next[index] + next[index + 1]); return next; }); }}/> : null}</Fragment>; })}<Action label="Saqlash" disabled={!valid} onPress={() => { if (valid)
    close({ ...data.node, title: title.trim() || 'Rezka', rezka_kadr_count: data.frames, rezka_frame_groups: [...groups], rezka_label_length: null }); }}/></Form>; }
export function BrigaderProductionMapDialog({ entry, owner, interactive, locale }: {
    entry: BrigaderPresentation;
    owner: BrigaderPresentations;
    interactive: () => boolean;
    locale: string;
}) { const size = useWindowDimensions(), close = (value?: unknown) => { if (interactive())
    owner.close(entry.id, value); }; if (entry.kind === 'calculatePicker')
    return <BrigaderAsyncPicker entry={entry} owner={owner} interactive={interactive} locale={locale}/>; if (entry.kind === 'orderConfirm')
    return <BrigaderOrderConfirmation locale={locale} close={close}/>; if (entry.kind === 'graphGroup') {
    const data = entry.data as {
        group: {
            key: string;
        };
        items: AdminApparatus[];
        enabled: ReadonlySet<string>;
    };
    return <ScrollView style={{ maxHeight: size.height * .9 }}><BrigaderSurfaceHeader title={productionGroupLabel(data.group.key, locale)} closeLabel="Skip" onClose={() => close({ skip: true })}/>{data.items.map((item, index) => <FeatureRow key={item.id} title={item.name} index={index} count={data.items.length} disabled={!data.enabled.has(item.id)} onPress={() => close({ skip: false, apparatus: item })}/>)}</ScrollView>;
} return <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: size.height * .9 }}><View>{entry.kind === 'graphNode' ? <NodeEditor node={entry.data as Node} owner={owner} interactive={interactive} close={close}/> : entry.kind === 'graphRezka' ? <RezkaEditor data={entry.data as Parameters<typeof RezkaEditor>[0]['data']} interactive={interactive} close={close}/> : entry.kind === 'graphFormula' ? <FormulaEditor data={entry.data as Parameters<typeof FormulaEditor>[0]['data']} interactive={interactive} close={close}/> : null}</View></ScrollView>; }
