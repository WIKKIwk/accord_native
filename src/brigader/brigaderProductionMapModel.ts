import type { Session } from '../auth';
import { adminApparatus, type AdminApparatus } from '../apparatusApi';
import { nativeEpochMicroseconds } from '../../modules/accord-native-clock/src/AccordNativeClockModule';
import { isCanonicalApparatusId, WorkerControlException } from '../workerControlsApi';
import { MobileApiException } from '../shared/mobileApiException';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { CalculateOrderTemplateStore } from '../admin/calculateOrderTemplateStore';
import type { CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
import { adminSaveProductionMap, adminSaveProductionMapWithOrder } from '../admin/productionMapDraftApi';
import { adminProductionMapOrderSummary } from '../admin/adminOrderSummaryApi';
import { productionMapDefinitionFromJson } from '../workerProductionMapSaved';
import { productionMapWithoutAlternativeAssignments, type ProductionMapDraft, type ProductionMapDraftNode as Node } from '../admin/productionMapDraftModel';
import { BrigaderModel } from './brigaderModel';
import { BrigaderPresentations } from './brigaderPresentations';
import { BrigaderProductionMapArgs } from './brigaderProductionMapArgs';
import { canonicalApparatusGroups } from './brigaderApparatusController';
import { isProductionRezka, productionApparatusMatches, productionApparatusMatchesMap } from './productionMapApparatusPolicy';
import { clampProductionNode, firstFreeProductionPosition, resolveProductionOverlaps, type CanvasPoint } from './productionMapGraphGeometry';
import type { BrigaderAsyncPickerSpec } from './brigaderAsyncPickerModel';
export type ProductionEdge = ProductionMapDraft['edges'][number];
export type ProductionApparatusGroup = ReturnType<typeof canonicalApparatusGroups>[number];
export const productionGroupLabel = (key: string) => adminText(key === 'extrusion_lamination' ? 'apparatus.option.extruder_laminatsiya' : `apparatus.group.${key}`, localeController.locale);
export function newProductionNode(id: string, kind: string, title: string, x = 420, y = 32, extra: Partial<Node> = {}): Node { return { id, kind, title, x, y, apparatus_id: '', formula: null, role_code: '', item_code: '', qty_formula: '', from_location: '', to_location: '', alternative_group_id: '', alternative_group_label: '', alternative_assigned_title: '', alternative_assigned_apparatus_id: '', rezka_kadr_count: null, rezka_label_length: null, rezka_frame_groups: [], ...extra }; }
export type ProductionMapState = {
    nodes: Node[];
    edges: ProductionEdge[];
    loading: boolean;
    error: unknown;
    catalog: AdminApparatus[];
    saving: boolean;
    orderNumber: string;
    savedMapId: string;
    template: CalculateOrderTemplate | null;
    lastSavedTemplate: CalculateOrderTemplate | null;
    connectingFrom: string | null;
    connectingBranch: string;
    preview: CanvasPoint | null;
};
const edge = (from: string, to: string, branch = ''): ProductionEdge => ({ from, to, branch });
const first = (values: (string | undefined)[]) => values.map(value => value?.trim()).find(Boolean) || 'zakaz';
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'zakaz';
/** Source graph owner: original session, source geometry and one atomic server save. */
export class BrigaderProductionMapModel extends BrigaderModel<ProductionMapState> {
    readonly presentations = new BrigaderPresentations(this.current);
    readonly orderMode: boolean;
    readonly locked: ReadonlySet<string>;
    private next = 1;
    private readonly newOrderId: string;
    private catalogRead = 0;
    constructor(readonly session: Session, readonly args: BrigaderProductionMapArgs, readonly store: CalculateOrderTemplateStore, current: () => boolean, interactive: () => boolean, private readonly notice: (message: string, tone: 'success' | 'error') => void, readonly back: (result?: unknown) => void) {
        const saved = args.savedMap, context = args.orderContext, orderMode = !args.templateOnly && (!!context || !!saved?.id.trim().startsWith('zakaz-'));
        if (context && (context.apparatus.trim() || context.apparatusId.trim()) && (!context.apparatus.trim() || !isCanonicalApparatusId(context.apparatusId)))
            throw new TypeError('Canonical apparatus ID and display name are required together');
        const hasApparatus = !!context?.apparatus.trim(), nodes = saved ? [...saved.nodes] : orderMode ? [newProductionNode('start', 'start', 'Start'), newProductionNode('order', 'task', context!.orderName.trim() || 'Zakaz', 420, 164, { role_code: 'zakaz' }), ...(hasApparatus ? [newProductionNode('apparatus', 'apparatus', context!.apparatus.trim(), 420, 296, { apparatus_id: context!.apparatusId.trim() })] : []), newProductionNode('end', 'end', context!.productName.trim() || 'Mahsulot', 420, hasApparatus ? 428 : 296, { item_code: context!.itemCode })] : [newProductionNode('start', 'start', 'Start'), newProductionNode('cpp_calc', 'formula', 'CPP hisob', 420, 164, { formula: { target: 'cpp_kg', expression: 'order_qty * 1.08' } }), newProductionNode('qty_check', 'condition', 'Katta partiyami?', 420, 296, { formula: { target: '', expression: 'order_qty >= 100' } }), newProductionNode('end', 'end', 'End', 420, 520)], edges = saved ? [...saved.edges] : orderMode ? [edge('start', 'order'), ...(hasApparatus ? [edge('order', 'apparatus'), edge('apparatus', 'end')] : [edge('order', 'end')])] : [edge('start', 'cpp_calc'), edge('cpp_calc', 'qty_check')];
        super({ nodes, edges, loading: true, error: null, catalog: [], saving: false, orderNumber: context?.pendingOrderId ? context.templateDraft!.order_number : saved?.order_number.trim() ?? '', savedMapId: saved?.id.trim() ?? '', template: context?.templateDraft ?? null, lastSavedTemplate: null, connectingFrom: null, connectingBranch: '', preview: null }, current, interactive);
        this.orderMode = orderMode;
        this.newOrderId = !saved && orderMode ? `zakaz-draft-${nativeEpochMicroseconds()}` : '';
        this.locked = new Set([...args.lockedNodeIds].map(id => id.trim()).filter(Boolean));
        for (const node of nodes) {
            const match = /_(\d+)$/.exec(node.id.trim());
            if (match)
                this.next = Math.max(this.next, Number(match[1]) + 1);
        }
    }
    get title() { const context = this.args.orderContext; return context ? (context.orderName.trim() || 'Zakaz') : (this.args.savedMap?.title.trim() || 'Production map test'); }
    private mutable() { return this.interactive() && !this.args.readOnly; }
    loadCatalog = async () => { if (!this.current())
        return; const read = ++this.catalogRead; this.patch({ loading: true, error: null }); try {
        const catalog = await adminApparatus(this.session, { limit: 500, beforeSend: this.guard, readWitness: this.current });
        if (read === this.catalogRead)
            this.patch({ catalog: catalog.filter(item => item.lifecycle_state === 'active'), loading: false });
    }
    catch (error) {
        if (read === this.catalogRead)
            this.patch({ loading: false, error });
    } };
    matches = (item: AdminApparatus) => productionApparatusMatchesMap(item, this.args.orderContext, this.state.nodes, this.state.catalog);
    get groups() { return canonicalApparatusGroups(this.state.catalog).filter(group => group.key !== 'unclassified' && (this.isLamination(group) || group.apparatus.some(this.matches))); }
    isLamination = (group: ProductionApparatusGroup) => group.key === 'laminate' || group.key === 'extrusion_lamination';
    blocked = (group: ProductionApparatusGroup) => this.isLamination(group) && !group.apparatus.some(item => isCanonicalApparatusId(item.id) && this.matches(item));
    private insert(node: Node, condition = false) { const nodes = [...this.state.nodes], edges = [...this.state.edges], index = nodes.findIndex(item => item.kind === 'end'); if (index < 1)
        return; const previous = nodes[index - 1], end = nodes[index], placed = { ...node, ...firstFreeProductionPosition(nodes, { ...node, x: previous.x, y: previous.y + 132 }, new Set([end.id])) }; nodes.splice(index, 0, placed); const nextEdges = edges.filter(item => !(item.from === previous.id && item.to === end.id)); nextEdges.push(edge(previous.id, placed.id)); if (!condition)
        nextEdges.push(edge(placed.id, end.id)); this.patch({ nodes, edges: nextEdges }); this.pushEnd(); }
    private pushEnd() { const nodes = [...this.state.nodes], index = nodes.findIndex(node => node.kind === 'end'); if (index < 0)
        return; const end = nodes[index], deepest = nodes.filter(node => node.id !== end.id).reduce((max, node) => Math.max(max, node.y), end.y), moved = { ...end, y: deepest + 132 }; nodes[index] = { ...moved, ...firstFreeProductionPosition(nodes, moved, new Set([end.id])) }; this.patch({ nodes }); }
    add = async (kind: 'task' | 'formula' | 'condition') => { if (!this.mutable())
        return; const end = this.state.nodes.find(node => node.kind === 'end'); if (!end)
        return; const id = `${kind}_${this.next++}`; this.insert(newProductionNode(id, kind, kind === 'condition' ? 'Shart' : kind === 'formula' ? 'Hisob kitob' : this.orderMode ? 'Stansiya tanlang' : 'Ishlov jarayoni', end.x, end.y - 132, kind === 'condition' ? { formula: { target: '', expression: 'order_qty >= 100' } } : kind === 'formula' ? { formula: { target: 'result_kg', expression: 'order_qty' } } : { role_code: 'worker' }), kind === 'condition'); if (this.orderMode && kind === 'task')
        await this.edit(id); };
    addGroup = async (group: ProductionApparatusGroup) => { if (!this.mutable())
        return; const candidates = group.apparatus.filter(item => isCanonicalApparatusId(item.id)), compatible = candidates.filter(this.matches); if (!compatible.length) {
        this.notice('Mos aparat topilmadi', 'error');
        return;
    } const choice = await this.presentations.request<{
        skip: boolean;
        apparatus?: AdminApparatus;
    }>('graphGroup', { group, items: this.isLamination(group) ? candidates : compatible, enabled: new Set(compatible.map(item => item.id)) }); if (!choice || !this.current())
        return; const cut = group.key === 'cut'; if (choice.skip) {
        let settings: Node | undefined;
        if (cut) {
            const sample = compatible[0];
            settings = await this.rezka(newProductionNode(`rezka_${this.next++}`, 'apparatus', sample.name, 420, 0, { apparatus_id: sample.id }));
            if (!settings || !this.current())
                return;
        }
        this.insertAlternatives(group, compatible, settings);
        return;
    } const item = choice.apparatus; if (!item || !this.matches(item))
        return; if (cut) {
        const node = await this.rezka(newProductionNode(`rezka_${this.next++}`, 'apparatus', item.name, 420, 0, { apparatus_id: item.id }));
        if (node && this.current())
            this.insert(node);
    }
    else
        this.insert(newProductionNode(`apparatus_${this.next++}`, 'apparatus', item.name, 420, 0, { apparatus_id: item.id })); };
    private insertAlternatives(group: ProductionApparatusGroup, items: AdminApparatus[], settings?: Node) { const nodes = [...this.state.nodes], endIndex = nodes.findIndex(node => node.kind === 'end'); if (endIndex <= 0 || !items.length)
        return; const end = nodes[endIndex], incoming = this.state.edges.filter(edge => edge.to === end.id), candidates = incoming.length ? incoming.flatMap(edge => nodes.filter(node => node.id === edge.from)) : [nodes[endIndex - 1]], previous = new Map<string, Node>(); for (const candidate of candidates) {
        let chosen = candidate;
        const key = candidate.alternative_group_id.trim();
        if (candidate.kind === 'apparatus' && key) {
            const members = nodes.filter(node => node.kind === 'apparatus' && node.alternative_group_id.trim() === key), assigned = new Set(members.map(node => node.alternative_assigned_apparatus_id.trim()).filter(Boolean));
            if (assigned.size) {
                const selected = members.filter(node => assigned.has(node.apparatus_id.trim()));
                if (assigned.size !== 1 || selected.length !== 1) {
                    this.notice('Tanlangan aparat aniqlanmadi. Mapni qayta oching.', 'error');
                    return;
                }
                chosen = selected[0];
            }
            else {
                members.forEach(node => previous.set(node.id, node));
                continue;
            }
        }
        previous.set(chosen.id, chosen);
    } if (!previous.size)
        return; const parents = [...previous.values()], groupId = `alt_${group.key}_${this.next}`, bottom = parents.reduce((max, node) => Math.max(max, node.y), -1600), center = parents.reduce((sum, node) => sum + node.x + 130, 0) / parents.length, firstX = center - 260 * items.length / 2, created = items.map((item, index) => newProductionNode(`apparatus_${this.next++}`, 'apparatus', item.name, firstX + index * 260, bottom + 132, { apparatus_id: item.id, alternative_group_id: groupId, alternative_group_label: productionGroupLabel(group.key), rezka_kadr_count: settings?.rezka_kadr_count ?? null, rezka_frame_groups: settings?.rezka_frame_groups ?? [] })); nodes.splice(endIndex, 0, ...created); const edges = this.state.edges.filter(edge => edge.to !== end.id); created.forEach(node => { parents.forEach(parent => edges.push(edge(parent.id, node.id))); edges.push(edge(node.id, end.id)); }); this.patch({ nodes, edges }); this.pushEnd(); }
    move = (id: string, delta: CanvasPoint) => { if (!this.mutable() || this.locked.has(id))
        return; const nodes = this.state.nodes.map(node => node.id === id ? { ...node, ...clampProductionNode({ x: node.x + delta.x, y: node.y + delta.y }) } : node); this.patch({ nodes: resolveProductionOverlaps(nodes, id, this.locked) }); };
    delete = (id: string) => { const node = this.state.nodes.find(item => item.id === id); if (!this.mutable() || !node || this.locked.has(id) || node.kind === 'start' || node.kind === 'end')
        return; this.patch({ nodes: this.state.nodes.filter(node => node.id !== id), edges: this.state.edges.filter(edge => edge.from !== id && edge.to !== id) }); };
    removeEdge = (target: ProductionEdge) => { if (this.mutable() && !this.locked.has(target.to.trim()))
        this.patch({ edges: this.state.edges.filter(edge => !(edge.from === target.from && edge.to === target.to && edge.branch === target.branch)) }); };
    startConnection = (id: string, branch = '') => { if (this.mutable() && !this.locked.has(id))
        this.patch({ connectingFrom: id, connectingBranch: branch.trim().toLowerCase(), preview: null }); };
    connectionPreview = (point: CanvasPoint) => { if (this.mutable() && this.state.connectingFrom)
        this.patch({ preview: point }); };
    cancelConnection = () => { if (this.current())
        this.patch({ connectingFrom: null, connectingBranch: '', preview: null }); };
    finishConnection = (point: CanvasPoint) => { if (!this.mutable())
        return; const from = this.state.connectingFrom, branch = this.state.connectingBranch; this.cancelConnection(); if (!from)
        return; const target = [...this.state.nodes].reverse().find(node => node.id !== from && point.x >= node.x && point.x < node.x + 260 && point.y >= node.y && point.y < node.y + 60); if (!target || this.locked.has(from) || this.locked.has(target.id) || this.state.edges.some(edge => edge.from === from && edge.to === target.id && edge.branch.trim().toLowerCase() === branch))
        return; const edges = this.state.edges.filter(edge => !branch || edge.from !== from || edge.branch.trim().toLowerCase() !== branch); edges.push(edge(from, target.id, branch)); this.patch({ edges }); };
    private picker = <T>(spec: BrigaderAsyncPickerSpec<T>) => this.presentations.request<T>('calculatePicker', spec);
    edit = async (id: string) => {
        const node = this.state.nodes.find(item => item.id === id);
        if (!this.mutable() || !node || this.locked.has(id))
            return;
        let edited: Node | undefined;
        if (isProductionRezka(node, this.state.catalog)) {
            const group = node.alternative_group_id.trim();
            if (group && this.state.nodes.some(item => item.alternative_group_id.trim() === group && this.locked.has(item.id))) {
                this.notice('Ish boshlangan Rezka guruhi sozlamasini o‘zgartirib bo‘lmaydi.', 'error');
                return;
            }
            edited = await this.rezka(node);
            if (!edited || !this.current())
                return;
            this.patch({ nodes: this.state.nodes.map(item => item.id === id ? edited! : group && item.alternative_group_id.trim() === group && isProductionRezka(item, this.state.catalog) ? { ...item, rezka_kadr_count: edited!.rezka_kadr_count, rezka_frame_groups: edited!.rezka_frame_groups, rezka_label_length: null } : item) });
            return;
        }
        const station = node.kind === 'task' && node.id.trim() !== 'order' && node.role_code.trim() !== 'zakaz';
        if (node.kind === 'apparatus' || station) {
            const picked = await this.picker({ title: station ? 'Ishlov stansiyasi' : 'Aparat tanlang', hint: 'Aparat qidiring', pageSize: 50, load: async (query, offset, limit) => (await adminApparatus(this.session, { query, limit: 200, beforeSend: this.guard, readWitness: this.current })).filter(item => station ? productionApparatusMatches(item, this.args.orderContext) : this.matches(item)).slice(offset, offset + limit), key: item => item.id, titleFor: item => item.name, subtitle: () => 'Aparat' });
            if (picked)
                edited = { ...node, title: picked.name, apparatus_id: picked.id };
        }
        else
            edited = await this.presentations.request<Node>('graphNode', node);
        if (edited && this.current())
            this.patch({ nodes: this.state.nodes.map(item => item.id === id ? edited! : item) });
    };
    private async rezka(node: Node) { const saved = node.rezka_kadr_count ?? 0; let frames = saved > 0 ? saved : this.validFrameCount(this.args.orderContext?.templateDraft?.frame_count ?? 0); if (frames === 0 && this.orderMode && this.state.savedMapId) {
        try {
            const summary = await adminProductionMapOrderSummary(this.session, this.state.savedMapId, this.guard, this.current);
            frames = this.validFrameCount(summary.frame_count);
        }
        catch (error) {
            if (!this.current())
                return;
            if (!(error instanceof MobileApiException || error instanceof WorkerControlException) || ![404, 409].includes(error.statusCode ?? 0)) {
                this.notice('Buyurtma kadrlarini yuklab bo‘lmadi. Qayta urinib ko‘ring.', 'error');
                return;
            }
        }
    } if (!this.current())
        return; return this.presentations.request<Node>('graphRezka', { node, frames, products: this.args.orderContext?.templateDraft?.products ?? this.args.savedMap?.products ?? [] }); }
    private validFrameCount(value: number) { return Number.isFinite(value) && value > 0 && Number.isInteger(value) ? value : 0; }
    definition = (): ProductionMapDraft => { const c = this.args.orderContext, s = this.args.savedMap, number = this.state.orderNumber.trim(), source = first([c?.templateId, c?.orderName, c?.productName, c?.itemCode]), id = this.args.templateOnly ? (s?.id.trim() || `template-${slug(source)}`) : this.orderMode ? (this.state.savedMapId.trim() || this.newOrderId) : !c ? (s?.id.trim() || 'production-map-test') : /^\d{4}$/.test(number) ? `zakaz-${number}` : `zakaz-${slug(source)}`; return { ...productionMapDefinitionFromJson({}), products: c?.templateDraft?.products ?? s?.products ?? [], combo: c?.templateDraft?.combo ?? s?.combo ?? null, id, product_code: !c ? (s?.product_code.trim() || 'production-map-test') : first([c.itemCode, c.productName, c.orderName, c.templateId]), title: this.title, code: this.args.templateOnly ? s?.code.trim() ?? '' : this.orderMode && number ? number : first([c?.orderCode, s?.code]), order_number: this.args.templateOnly ? '' : number, customer_name: s?.customer_name ?? '', roll_count: c?.rollCount ?? s?.roll_count ?? null, width_mm: c?.widthMm ?? s?.width_mm ?? null, print_val_size_mm: c ? c.printValSizeMm : s?.print_val_size_mm ?? null, order_kg: s?.order_kg ?? null, base_length: s?.base_length ?? null, duplicate_rezka_labels: this.args.templateOnly ? null : c?.duplicateRezkaLabels ?? s?.duplicate_rezka_labels ?? null, include_bobina_in_net: this.args.templateOnly ? s?.include_bobina_in_net ?? null : c?.includeBobinaInNet ?? s?.include_bobina_in_net ?? null, standard_print_side: this.args.templateOnly ? s?.standard_print_side ?? null : c?.standardPrintSide ?? s?.standard_print_side ?? null, nodes: [...this.state.nodes], edges: [...this.state.edges] }; };
    private validate(map: ProductionMapDraft) { const packageIds = new Set(this.state.template?.status.trim().toLowerCase() === 'rulon' ? this.state.catalog.filter(item => item.operation === 'package').map(item => item.id.trim()) : []); for (const node of map.nodes) {
        if (node.kind === 'apparatus') {
            if (packageIds.has(node.apparatus_id.trim()) || packageIds.has(node.alternative_assigned_apparatus_id.trim()))
                throw new MobileApiException({ code: 'rulon_order_package_not_allowed', message: 'Rulon buyurtmasiga paket apparatini qo‘shib bo‘lmaydi' });
            if (!isCanonicalApparatusId(node.apparatus_id))
                throw new MobileApiException({ code: 'canonical_apparatus_id_required', message: 'Aparatni canonical ro‘yxatdan qayta tanlang' });
            if ((node.alternative_assigned_title.trim() || node.alternative_assigned_apparatus_id.trim()) && !isCanonicalApparatusId(node.alternative_assigned_apparatus_id))
                throw new MobileApiException({ code: 'canonical_assigned_apparatus_id_required', message: 'Alternative aparatni canonical ro‘yxatdan qayta tanlang' });
        }
        if (isProductionRezka(node, this.state.catalog)) {
            const count = node.rezka_kadr_count ?? 0, groups = node.rezka_frame_groups;
            if (count <= 0 || groups.length && (groups.some(value => value <= 0) || groups.reduce((a, b) => a + b, 0) !== count))
                throw new MobileApiException({ code: 'rezka_kadr_count_required', message: `${node.title}: kadr sozlamasi to‘liq emas. Rezka sozlash oynasini ochib, kadrlarni saqlang.` });
        }
    } }
    save = async () => { if (!this.mutable() || this.state.saving)
        return; const scope = this.store.captureScope(), creating = this.orderMode && !/^\d{4}$/.test(this.state.orderNumber.trim()); if (creating && (!await this.presentations.request<boolean>('orderConfirm', null) || !this.current() || !this.store.isCurrentScope(scope)))
        return; this.patch({ saving: true }); try {
        const map = this.definition();
        this.validate(map);
        let saved: ProductionMapDraft;
        if (this.state.template) {
            const result = await adminSaveProductionMapWithOrder(this.session, productionMapWithoutAlternativeAssignments(map), this.state.template, this.args.orderContext?.pendingOrderId ?? '', this.state.lastSavedTemplate ? 'update' : this.args.orderContext?.templateAction ?? '', this.guard);
            if (!this.current() || !this.store.isCurrentScope(scope))
                return;
            saved = result.saved.map;
            this.patch({ lastSavedTemplate: result.template, template: result.template ?? this.state.template });
            if (result.template)
                this.store.remember(result.template, { scope });
            if (this.orderMode)
                this.patch({ savedMapId: saved.id.trim(), orderNumber: saved.order_number.trim() });
            this.savedNotice(saved, creating);
            if (this.args.orderContext?.pendingOrderId)
                this.back(result.template);
        }
        else {
            const result = await adminSaveProductionMap(this.session, map, this.guard);
            if (!this.current() || !this.store.isCurrentScope(scope))
                return;
            saved = result.map;
            if (this.orderMode)
                this.patch({ savedMapId: saved.id.trim(), orderNumber: saved.order_number.trim() });
            this.savedNotice(saved, creating);
        }
    }
    catch (error) {
        if (this.current())
            this.notice(error instanceof MobileApiException || error instanceof WorkerControlException ? error.message : 'Production map saqlanmadi', 'error');
    }
    finally {
        this.patch({ saving: false });
    } };
    private savedNotice(saved: ProductionMapDraft, creating: boolean) { const number = saved.order_number.trim(); this.notice(this.orderMode && number ? creating ? `Map saqlandi. №${number} buyurtmasi ochildi.` : `Map saqlandi. №${number} buyurtmasi yangilandi.` : 'Production map saqlandi', 'success'); }
    close = () => { if (this.interactive())
        this.back(this.state.lastSavedTemplate); };
    override dispose() { super.dispose(); this.catalogRead++; this.presentations.dispose(); }
}
