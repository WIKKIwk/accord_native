import { openedOrderEditErrorReason } from '../admin/openedOrderEditErrorReason';
import type { Session } from '../auth';
import { nativeEpochMicroseconds } from '../../modules/accord-native-clock/src/AccordNativeClockModule';
import { MobileApiException } from '../shared/mobileApiException';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { sessionReadScope } from '../sessionReadScope';
import { calculateDraft, productionComboLayoutSignature, adminSaveProductionCombo, orderPrintSidePreference, adminSaveProductionMapWithOrder, adminAutoOpenProductionMap, adminSaveOpenedOrderEdit, uploadCalculateOrderImage } from '../admin/productionMapDraftApi';
import { adminProductionMap } from '../productionMapReadApi';
import { adminProductionCombo } from '../productionComboApi';
import { WorkerControlException } from '../workerControlsApi';
import { productionMapWithoutAlternativeAssignments, type ProductionMapDraft } from '../admin/productionMapDraftModel';
import { calculateOrderTemplateToJson } from '../admin/calculateOrderTemplateModel';
import { adminItemDetail } from '../admin/adminItemDetailApi';
import { readAdminItemCreateCustomers } from '../admin/adminItemCreateCustomersApi';
import { adminWorkerDetailMaterials } from '../admin/adminWorkerDetailAssignmentsApi';
import { qolipCatalogRuntimeFor } from '../shared/qolipCatalogRuntime';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import type { SupplierItem } from '../shared/catalogApi';
import { BrigaderProductionMapArgs, type ProductionMapOrderContext } from './brigaderProductionMapArgs';
import { calculateProductPickerPage, type CalculateProductOption } from './calculateProductPicker';
import { clearBrigaderPickerMemory, type BrigaderAsyncPickerSpec } from './brigaderAsyncPickerModel';
import type { CalculateOrderTemplateStore } from '../admin/calculateOrderTemplateStore';
import type { CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
import { openedOrderEditRestrictionsFromJson } from '../workerOpenedOrderEditApi';
import type { calculateResponseFromJson } from '../calculateApi';
import { BrigaderModel } from './brigaderModel';
import { BrigaderPresentations } from './brigaderPresentations';
import { BrigaderCalculateArgs } from './brigaderCalculateArgs';
import { initialCalculateDraft, applyCalculateTemplate, buildCalculateTemplate, calculateDraftSignature, calculateRequestForDraft, calculateNumberError, calculateProductsError, newCalculateProduct, calculateActiveProducts, calculateOrderName, calculateItemCode, type CalculateDraft } from './brigaderCalculateDraft';
export type CalculatePageActions = {
    openMap: (args: BrigaderProductionMapArgs) => Promise<CalculateOrderTemplate | undefined>;
    createProduct: () => Promise<SupplierItem | undefined>;
    back: (result: unknown) => void;
    pickImage: () => Promise<{
        uri: string;
        filename: string;
        bytes: Uint8Array;
    } | null>;
    canCreateProduct: () => boolean;
};
export type BrigaderCalculateState = {
    draft: CalculateDraft;
    calculating: boolean;
    loadingCombo: boolean;
    openingSaved: boolean;
    openingAuto: boolean;
    savingOpened: boolean;
    openingTraining: boolean;
    uploadingImage: boolean;
    result: ReturnType<typeof calculateResponseFromJson> | null;
    lastSignature: string;
    error: string;
    errors: Record<string, string>;
    micronFocus: number | null;
    micronFocusVersion: number;
};
/** Original calculator owner. Route/picker compositions are bound by the actual page. */
export class BrigaderCalculateModel extends BrigaderModel<BrigaderCalculateState> {
    readonly presentations = new BrigaderPresentations(this.current);
    readonly restrictions: ReturnType<typeof openedOrderEditRestrictionsFromJson>;
    protected comboScope = '';
    protected comboSignature = '';
    protected customerGeneration = 0;
    protected savedRequestId = '';
    protected savedRequestSignature = '';
    private printSideProductKey = '';
    private printSideLayoutKey = '';
    private printSideRead = 0;
    private printSideTimer: ReturnType<typeof setTimeout> | null = null;
    constructor(readonly session: Session, readonly store: CalculateOrderTemplateStore, readonly args: BrigaderCalculateArgs, current: () => boolean, interactive: () => boolean, protected readonly notice: (message: string, tone: 'success' | 'error') => void, readonly actions: CalculatePageActions) {
        const initial = initialCalculateDraft(), template = args.openedOrder?.template ?? args.template;
        initial.editingAll = !args.template || !!args.pendingOrderId || !!args.openedOrder;
        const draft = template ? applyCalculateTemplate(initial, template, !!args.pendingOrderId || !!args.openedOrder) : initial;
        super({ draft, calculating: false, loadingCombo: false, openingSaved: false, openingAuto: false, savingOpened: false, openingTraining: false, uploadingImage: false, result: null, lastSignature: '', error: '', errors: {}, micronFocus: null, micronFocusVersion: 0 }, current, interactive);
        this.restrictions = args.openedOrder?.restrictions ?? openedOrderEditRestrictionsFromJson(null);
        if (draft.combo) {
            this.comboScope = sessionReadScope(session);
            try {
                this.comboSignature = productionComboLayoutSignature(this.template());
            }
            catch { /* Source catches invalid incomplete layout on reads. */ }
        }
    }
    protected a = (key: string, values?: Record<string, unknown>) => adminText(key, localeController.locale, values);
    get needsCombo() { return this.state.draft.multiple && !this.args.trainingMode && (!this.args.openedOrder || !!this.state.draft.combo); }
    get currentCombo() { if (!this.state.draft.combo || this.comboScope !== sessionReadScope(this.session))
        return false; try {
        return this.comboSignature === productionComboLayoutSignature(this.template());
    }
    catch {
        return false;
    } }
    get fresh() { return !this.state.calculating && !this.state.loadingCombo && !!this.state.result && this.state.lastSignature === this.signature() && (!this.needsCombo || this.currentCombo); }
    signature = () => calculateDraftSignature(this.state.draft, this.needsCombo);
    template = () => buildCalculateTemplate(this.state.draft, this.a('calculate.order'), this.args.openedOrder?.template.order_number ?? (this.args.pendingOrderId ? this.args.template!.order_number : ''));
    protected draft(change: Partial<CalculateDraft>) { this.patch({ draft: { ...this.state.draft, ...change } }); this.rememberPrintSide(); }
    start = () => { if (!this.current())
        return; if (!this.args.trainingMode && !this.args.openedOrder)
        void this.store.load().catch(() => { }); this.rememberPrintSide(); };
    protected apply(template: CalculateOrderTemplate) { this.draft(applyCalculateTemplate(this.state.draft, template, !!this.args.pendingOrderId || !!this.args.openedOrder)); this.patch({ result: null, lastSignature: '' }); if (this.state.draft.combo) {
        this.comboScope = sessionReadScope(this.session);
        this.comboSignature = productionComboLayoutSignature(this.template());
    } }
    change = (key: 'customer' | 'product' | 'kg' | 'frame' | 'count' | 'edge' | 'printVal' | 'waste' | 'rolls' | 'note' | 'color', value: string) => { if (!this.interactive() || this.restrictions.dimensions_locked && ['frame', 'count', 'edge'].includes(key))
        return; this.draft({ [key]: value }); };
    layer = (index: number, key: 'material' | 'micron', value: string) => { if (!this.interactive() || this.restrictions.locked_layer_indices.has(index) || !this.state.draft.layers[index])
        return; this.draft({ layers: this.state.draft.layers.map((row, i) => i === index ? { ...row, [key]: value } : row) }); };
    addLayer = () => { if (this.interactive() && !this.restrictions.layer_structure_locked)
        this.draft({ layers: [...this.state.draft.layers, { materialId: '', material: '', micron: '' }] }); };
    removeLayer = (index: number) => { if (this.interactive() && !this.restrictions.layer_structure_locked && this.state.draft.layers.length > 1 && index >= 0 && index < this.state.draft.layers.length)
        this.draft({ layers: this.state.draft.layers.filter((_, i) => i !== index) }); };
    protected fork() { const d = this.state.draft; if (this.args.openedOrder || !d.templateId)
        return; const id = `quick-${nativeEpochMicroseconds()}`; this.savedRequestId = ''; this.savedRequestSignature = ''; this.draft({ templateId: id, orderCode: `Z-${id}`, variantId: id, fork: !!d.sourceMapId }); }
    multiple = (enabled: boolean) => { if (!this.interactive() || this.restrictions.dimensions_locked)
        return; this.fork(); const d = this.state.draft, products = [...d.products]; if (enabled) {
        const first = { ...(products[0] ?? newCalculateProduct()), itemCode: d.itemCode, product: d.product, width: d.frame, count: d.count };
        products[0] = first;
        this.draft({ multiple: true, products });
    }
    else {
        const first = products[0];
        this.comboSignature = '';
        this.draft({ multiple: false, combo: null, ...(first ? { itemCode: first.itemCode, product: first.product, frame: first.width, count: first.count } : {}) });
    } this.patch({ result: null, lastSignature: '' }); };
    addProduct = () => { if (!this.interactive() || this.restrictions.dimensions_locked || this.state.draft.products.length >= 64)
        return; this.fork(); this.draft({ products: [...this.state.draft.products, newCalculateProduct()] }); };
    removeProduct = (index: number) => { if (!this.interactive() || this.restrictions.dimensions_locked || this.state.draft.products.length <= 1 || !this.state.draft.products[index])
        return; this.fork(); this.draft({ products: this.state.draft.products.filter((_, i) => i !== index) }); };
    moveProduct = (index: number, delta: number) => { const next = index + delta; if (!this.interactive() || this.restrictions.dimensions_locked || next < 0 || next >= this.state.draft.products.length)
        return; this.fork(); const products = [...this.state.draft.products]; products.splice(next, 0, products.splice(index, 1)[0]); this.draft({ products }); };
    product = (index: number, key: 'product' | 'width' | 'count', value: string) => { if (!this.interactive() || this.restrictions.dimensions_locked || !this.state.draft.products[index])
        return; this.draft({ products: this.state.draft.products.map((row, i) => i === index ? { ...row, [key]: value } : row) }); };
    toggle = (key: 'byVal' | 'duplicateLabels' | 'includeBobina', value: boolean) => { if (!this.interactive() || (key !== 'byVal' && (this.state.openingSaved || this.state.openingAuto)))
        return; this.draft({ [key]: value }); };
    printSide = (value: boolean) => { if (this.interactive() && !this.state.openingSaved && !this.state.openingAuto)
        this.draft({ standardSide: value }); };
    editAll = () => { if (this.interactive())
        this.draft({ editingAll: true }); };
    protected formErrors() { const d = this.state.draft, errors: Record<string, string> = {}, full = d.editingAll || d.multiple; const number = (key: string, value: string, options: Parameters<typeof calculateNumberError>[1]) => { const error = calculateNumberError(value, options); if (error)
        errors[key] = this.a(`calculate.${error}`); }; if (full && !d.multiple) {
        if (!d.product.trim())
            errors.product = this.a('calculate.required');
        number('frame', d.frame, { required: true });
        number('count', d.count, { required: true });
    } if (d.options.print_method === 'flexo')
        number('edge', d.edge, { required: true, zero: true, finite: true }); if (d.byVal)
        number('printVal', d.printVal, { required: true, finite: true }); number('kg', d.kg, { required: true }); number('waste', d.waste, { required: true, zero: true }); if (full) {
        number('rolls', d.rolls, { integer: true });
        d.layers.forEach((row, index) => { if (!row.material.trim())
            errors[`layer:${index}:material`] = this.a('calculate.required'); number(`layer:${index}:micron`, row.micron, { required: true }); });
    } this.patch({ errors }); return Object.keys(errors).length === 0; }
    calculate = async () => { if (!this.interactive() || this.state.calculating || this.state.loadingCombo)
        return; const d = this.state.draft, productsError = calculateProductsError(d); if (productsError) {
        this.notice(this.a(productsError), 'error');
        return;
    } if (!d.multiple && !d.product.trim()) {
        this.notice(this.a('calculate.product_select'), 'error');
        return;
    } if (!this.formErrors()) {
        this.notice(this.a('calculate.required_fields'), 'error');
        return;
    } const signature = this.signature(), scope = sessionReadScope(this.session), draft = this.template(); this.patch({ calculating: true, error: '' }); try {
        const result = await calculateDraft(this.session, calculateRequestForDraft(d, this.a('calculate.order')), this.guard);
        if (!this.current() || scope !== sessionReadScope(this.session) || signature !== this.signature())
            return;
        if (!await this.persistCombo(draft, signature, scope) || !this.current() || scope !== sessionReadScope(this.session))
            return;
        this.patch({ result, lastSignature: signature });
    }
    catch (error) {
        if (!this.current() || scope !== sessionReadScope(this.session))
            return;
        this.patch({ error: error instanceof MobileApiException ? error.message : String(error), result: null, lastSignature: '' });
        this.notice(this.a('calculate.calculate_error'), 'error');
    }
    finally {
        this.patch({ calculating: false });
    } };
    private async persistCombo(draft: CalculateOrderTemplate, signature: string, scope: string) { if (!this.needsCombo || this.currentCombo)
        return true; let name = this.state.draft.combo?.name; if (!name?.trim())
        name = await this.presentations.request<string>('comboName', null); if (!this.current() || scope !== sessionReadScope(this.session) || signature !== this.signature() || name === undefined)
        return false; const previous = this.state.draft.combo, saved = await adminSaveProductionCombo(this.session, name, draft, previous?.id ?? null, this.guard); if (!this.current() || scope !== sessionReadScope(this.session) || signature !== this.signature())
        return false; this.comboScope = scope; this.comboSignature = productionComboLayoutSignature(draft); this.draft({ combo: saved }); if (previous?.item_code !== saved.item_code) {
        clearBrigaderPickerMemory();
        qolipCatalogRuntimeFor(this.session).reset();
        qolipDataRevision.notifyLocationsChanged();
    } if (previous !== null && previous.item_code !== saved.item_code)
        this.notice(this.a('calculate.combo_new_revision'), 'success'); return true; }
    protected rememberPrintSide() { if (!this.current() || this.args.trainingMode || this.args.openedOrder)
        return; let template: CalculateOrderTemplate; try {
        template = this.template();
    }
    catch {
        this.printSideRead++;
        this.printSideLayoutKey = '';
        if (this.printSideTimer)
            clearTimeout(this.printSideTimer);
        this.patch({ draft: { ...this.state.draft, rememberedSide: null } });
        return;
    } const scope = sessionReadScope(this.session), productKey = JSON.stringify([scope, template.customer_ref.trim(), template.item_code.trim(), template.variant_id, template.source_map_id, ...template.products.map(product => product.item_code.trim())]); if (productKey !== this.printSideProductKey) {
        this.printSideProductKey = productKey;
        this.patch({ draft: { ...this.state.draft, standardSide: null } });
    } const layoutKey = JSON.stringify([productKey, template.frame_product_size_mm, template.frame_count, template.print_val_size_mm, template.production_options?.print_method ?? '', template.color.trim(), template.image_id.trim(), template.combo?.item_code ?? null, ...template.products.map(product => [product.frame_product_size_mm, product.frame_count])]); if (layoutKey === this.printSideLayoutKey)
        return; this.printSideLayoutKey = layoutKey; this.patch({ draft: { ...this.state.draft, rememberedSide: null } }); if (this.printSideTimer)
        clearTimeout(this.printSideTimer); const read = ++this.printSideRead; if (!template.customer_ref.trim() || !template.item_code.trim() && !template.products.length)
        return; this.printSideTimer = setTimeout(() => { if (!this.current() || read !== this.printSideRead || scope !== sessionReadScope(this.session))
        return; void orderPrintSidePreference(this.session, template, this.guard).then(side => { if (this.current() && read === this.printSideRead && scope === sessionReadScope(this.session) && side !== this.state.draft.rememberedSide)
        this.patch({ draft: { ...this.state.draft, rememberedSide: side } }); }, () => { }); }, 200); }
    private picker = <T>(spec: BrigaderAsyncPickerSpec<T>) => this.presentations.request<T>('calculatePicker', spec);
    customerPicker = async () => { if (!this.interactive() || this.state.draft.multiple && this.restrictions.dimensions_locked)
        return; const picked = await this.picker({ title: this.a('calculate.customer_select'), hint: this.a('calculate.customer_search'), pageSize: 50, autofocus: true, cacheKey: `${sessionReadScope(this.session)}:calculate:customers`, load: (query, offset, limit) => readAdminItemCreateCustomers(this.session, { query, offset, limit }, this.guard, this.current), key: item => item.ref, titleFor: item => item.name.trim() || item.ref, subtitle: item => item.phone.trim() ? `${item.ref} • ${item.phone.trim()}` : item.ref }); if (!picked || !this.current())
        return; this.customerGeneration++; const d = this.state.draft; if (d.customerRef !== picked.ref) {
        this.comboSignature = '';
        this.comboScope = '';
    } this.draft({ customerRef: picked.ref, customer: picked.name.trim() || picked.ref, ...(d.customerRef !== picked.ref ? { combo: null } : {}), itemCode: '', product: '', products: d.products.map(row => ({ ...row, itemCode: '', product: '' })) }); };
    materialPicker = async (index: number) => { const original = this.state.draft.layers[index]; if (!this.interactive() || !original || this.restrictions.locked_layer_indices.has(index))
        return; let request: ReturnType<typeof adminWorkerDetailMaterials> | null = null; const catalog = async () => { const read = request ??= adminWorkerDetailMaterials(this.session, this.guard, this.current); try {
        return await read;
    }
    catch (error) {
        if (request === read)
            request = null;
        throw error;
    } }; const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, ''); const picked = await this.picker({ title: this.a('calculate.layer_material_title'), hint: this.a('calculate.layer_material_search'), pageSize: 50, load: async (query, offset, limit) => (await catalog()).filter(item => item.active && (!normalize(query) || normalize(item.name).includes(normalize(query)))).slice(offset, offset + limit), key: item => item.id, titleFor: item => item.name, subtitle: item => this.a('calculate.variant_count', { count: item.variants.length }) }); if (!picked || !this.current() || !this.state.draft.layers[index])
        return; this.draft({ layers: this.state.draft.layers.map((row, i) => i === index ? { ...row, materialId: picked.id, material: picked.name } : row) }); this.patch({ micronFocus: index, micronFocusVersion: this.state.micronFocusVersion + 1 }); };
    choice = async (kind: 'orderType' | 'printMethod') => { if (!this.interactive() || this.restrictions.dimensions_locked)
        return; const picked = await this.presentations.request<string>('calculateChoice', { title: this.a(kind === 'orderType' ? 'calculate.order_type_input' : 'calculate.production_type_input'), options: kind === 'orderType' ? ['Rulon', 'Paket'] : ['Flexo', 'Temir'], selected: kind === 'orderType' ? (this.state.draft.orderType.toLowerCase() === 'paket' ? 'Paket' : 'Rulon') : (this.state.draft.options.print_method === 'flexo' ? 'Flexo' : 'Temir') }); if (!picked || !this.current())
        return; this.draft(kind === 'orderType' ? { orderType: picked } : { options: { ...this.state.draft.options, print_method: picked === 'Flexo' ? 'flexo' : 'metal' } }); };
    productPicker = async (index: number | null = null) => { if (!this.interactive() || index !== null && this.restrictions.dimensions_locked)
        return; const d = this.state.draft, target = index === null ? null : d.products[index]; if (index !== null && (!target || !d.customerRef)) {
        if (!d.customerRef)
            this.notice(this.a('calculate.products_customer'), 'error');
        return;
    } const customerRef = d.customerRef, scope = sessionReadScope(this.session), customerName = d.customer.trim(); let create = false; const option = await this.picker<CalculateProductOption>({ title: this.a('calculate.product_select'), hint: this.a('calculate.product_search'), autofocus: true, pageSize: 80, cacheKey: `${scope}:calculate:products:v3:${index === null ? 'catalog' : 'components'}:${customerRef.trim()}`, load: (query, offset, limit) => calculateProductPickerPage(this.session, customerRef, customerName, index === null && !this.args.openedOrder, query, offset, limit, this.guard, this.current), key: option => option.item.code, titleFor: option => option.item.name.trim() || option.item.code, subtitle: option => option.customerName, ...(this.actions.canCreateProduct() ? { addLabel: this.a('item.add_title'), onAdd: () => { create = true; } } : {}) }); if (!this.current())
        return; let picked = option?.item; if (create) {
        picked = await this.actions.createProduct();
        clearBrigaderPickerMemory();
    } if (!picked || !this.current())
        return; if (picked.item_group.trim().toLowerCase() === 'kombo') {
        if (scope === sessionReadScope(this.session) && index === null)
            await this.selectCombo(picked);
        return;
    } if (index !== null) {
        const current = this.state.draft.products[index];
        if (!current || current.id !== target?.id || customerRef !== this.state.draft.customerRef)
            return;
        this.fork();
        this.draft({ products: this.state.draft.products.map((row, i) => i === index ? { ...row, itemCode: picked.code, product: picked.name.trim() || picked.code } : row) });
        return;
    } const existing = this.store.templates.find(template => template.id.trim() !== this.state.draft.templateId.trim() && !template.products.length && template.item_code.trim() === picked.code.trim()); let recreate = false; if (!this.args.openedOrder && existing) {
        const action = await this.presentations.request<'cancel' | 'recreate' | 'useTemplate'>('quickRecreate', null);
        if (!this.current() || !action || action === 'cancel')
            return;
        if (action === 'useTemplate') {
            const generation = ++this.customerGeneration;
            this.draft({ editingAll: true });
            this.apply(existing);
            this.draft({ itemCode: picked.code, product: picked.name.trim() || picked.code });
            if (!this.state.draft.customerRef.trim() && !this.state.draft.customer.trim())
                void this.autoCustomer(picked, generation);
            return;
        }
        recreate = true;
    } if (!this.current())
        return; const auto = !this.state.draft.customerRef.trim() && !this.state.draft.customer.trim(); if (!this.args.openedOrder && (recreate || this.state.draft.templateId && picked.code.trim() !== this.state.draft.itemCode.trim())) {
        if (this.state.draft.templateId)
            this.fork();
        else {
            const id = `quick-${nativeEpochMicroseconds()}`;
            this.draft({ templateId: id, orderCode: `Z-${id}`, variantId: id, fork: !!this.state.draft.sourceMapId.trim() });
        }
    } const generation = ++this.customerGeneration; this.comboSignature = ''; this.draft({ combo: null, itemCode: picked.code, product: picked.name.trim() || picked.code }); if (auto)
        void this.autoCustomer(picked, generation); };
    private async autoCustomer(item: SupplierItem, generation: number) { try {
        const detail = await adminItemDetail(this.session, item.code, {}, this.guard, this.current), eligible = detail.customers.filter(customer => customer.ref.trim()), customer = eligible.find(customer => customer.name.trim().toLowerCase() !== 'saidamin') ?? eligible[0];
        if (!this.current() || generation !== this.customerGeneration || !customer || this.state.draft.customerRef.trim() || this.state.draft.customer.trim())
            return;
        this.draft({ customerRef: customer.ref, customer: customer.name.trim() || customer.ref });
    }
    catch { /* Source optional default owner lookup is silent. */ } }
    private async selectCombo(item: SupplierItem) { if (this.state.calculating || this.state.loadingCombo || this.args.openedOrder)
        return; const scope = sessionReadScope(this.session), generation = ++this.customerGeneration; this.patch({ loadingCombo: true }); try {
        const entry = await adminProductionCombo(this.session, item.code, this.guard);
        if (!this.current() || scope !== sessionReadScope(this.session) || generation !== this.customerGeneration)
            return;
        if (!entry.template.products.length)
            throw new SyntaxError('Kombo tarkibi topilmadi');
        this.customerGeneration++;
        this.draft({ editingAll: true });
        this.apply({ ...entry.template, combo: entry.combo, id: '', code: '', source_map_id: '', variant_id: '', order_number: '' });
    }
    catch (error) {
        if (this.current() && scope === sessionReadScope(this.session))
            this.notice(this.operationError(error, 'calculate.combo_load_failed'), 'error');
    }
    finally {
        this.patch({ loadingCombo: false });
    } }
    private operationError(error: unknown, key: string) { return error instanceof MobileApiException || error instanceof WorkerControlException ? error.message : this.a(key); }
    private templateValid() { const d = this.state.draft, invalid = !!calculateProductsError(d) || !d.multiple && (!d.product.trim() || !!calculateNumberError(d.frame, { required: true }) || !!calculateNumberError(d.count, { required: true })) || d.options.print_method === 'flexo' && !!calculateNumberError(d.edge, { required: true, zero: true, finite: true }) || d.byVal && !!calculateNumberError(d.printVal, { required: true, finite: true }) || !!calculateNumberError(d.waste, { required: true, zero: true }) || d.layers.some(row => !row.material.trim() || !!calculateNumberError(row.micron, { required: true })) || !!calculateNumberError(d.rolls, { integer: true }); if (invalid) {
        this.notice(this.a('calculate.order_details_required'), 'error');
        return false;
    } return true; }
    private requireFresh() { if (this.fresh)
        return true; this.notice(this.a('calculate.calculate_first'), 'error'); return false; }
    get sideForSave() { return this.state.draft.standardSide ?? this.state.draft.rememberedSide; }
    orderContext = (): ProductionMapOrderContext => { const d = this.state.draft, template = this.template(), name = calculateOrderName(d, this.a('calculate.order')); return { pendingOrderId: this.args.pendingOrderId, templateId: d.templateId, orderCode: d.orderCode, orderName: name, productName: name, itemCode: calculateItemCode(d), rollCount: template.roll_count, widthMm: template.width_mm, printValSizeMm: template.print_val_size_mm, duplicateRezkaLabels: d.duplicateLabels, includeBobinaInNet: d.includeBobina, standardPrintSide: this.sideForSave, apparatus: this.args.trainingMode ? this.args.trainingApparatus.trim() : '', apparatusId: this.args.trainingMode ? this.args.trainingApparatusId.trim() : '', templateDraft: template, templateAction: d.fork ? 'fork' : 'update' }; };
    private missingMap(error: unknown) { if ((error instanceof MobileApiException || error instanceof WorkerControlException) && error.code === 'map_not_found' && (error.statusCode === 404 || error.statusCode == null)) {
        this.draft({ sourceMapId: '', editingAll: true });
        this.notice(this.a('calculate.quick_map_missing'), 'error');
        return true;
    } return false; }
    openMap = async (readOnly = false) => { if (!this.interactive() || !readOnly && (!this.requireFresh() || !this.templateValid()))
        return; const sourceId = this.state.draft.sourceMapId.trim(); if (readOnly && !sourceId) {
        this.notice(this.a('calculate.quick_map_unlinked'), 'error');
        return;
    } const context = this.orderContext(); let map: ProductionMapDraft | null = null; if (sourceId) {
        try {
            const source = await adminProductionMap(this.session, sourceId, this.guard, this.current);
            if (!this.current())
                return;
            const clean = productionMapWithoutAlternativeAssignments(source.map), t = this.template(), d = this.state.draft;
            map = readOnly ? clean : { ...clean, products: calculateActiveProducts(d), combo: d.multiple ? d.combo : null, id: d.fork ? `template-${d.templateId}` : clean.id, title: context.orderName, image_id: d.imageId.trim(), product_code: calculateItemCode(d).trim() || clean.product_code, roll_count: t.roll_count, width_mm: t.width_mm, print_val_size_mm: t.print_val_size_mm };
        }
        catch (error) {
            if (this.current() && !this.missingMap(error))
                this.notice(this.a('calculate.quick_map_load_failed'), 'error');
            return;
        }
    } if (!this.current())
        return; const saved = await this.actions.openMap(new BrigaderProductionMapArgs(context, map, readOnly, !readOnly && !!sourceId)); if (!saved || !this.current() || readOnly)
        return; if (this.args.pendingOrderId) {
        this.actions.back(true);
        return;
    } this.apply(saved); this.draft({ editingAll: false, ...(!sourceId ? { duplicateLabels: false, includeBobina: false, standardSide: null } : {}) }); };
    openSaved = async () => { if (!this.interactive() || this.state.openingSaved || !this.requireFresh())
        return; const sourceId = this.state.draft.sourceMapId.trim(); if (!sourceId) {
        this.notice(this.a('calculate.quick_map_unlinked'), 'error');
        return;
    } if (!this.templateValid() || !await this.presentations.request<boolean>('orderConfirm', null) || !this.current())
        return; this.patch({ openingSaved: true }); const scope = this.store.captureScope(); try {
        const source = await adminProductionMap(this.session, sourceId, this.guard, this.current);
        if (!this.current() || !this.store.isCurrentScope(scope))
            return;
        const clean = productionMapWithoutAlternativeAssignments(source.map), t = this.template(), d = this.state.draft, signatureFields = calculateOrderTemplateToJson(t);
        delete signatureFields.saved_at;
        const signature = `${JSON.stringify(signatureFields)}|${d.duplicateLabels}|${d.includeBobina}|${this.sideForSave}`;
        if (!this.savedRequestId || signature !== this.savedRequestSignature) {
            this.savedRequestId = `zakaz-draft-${nativeEpochMicroseconds()}`;
            this.savedRequestSignature = signature;
        }
        const map: ProductionMapDraft = { ...clean, products: calculateActiveProducts(d), combo: d.multiple ? d.combo : null, id: this.savedRequestId, title: t.name, image_id: t.image_id.trim(), code: '', order_number: '', product_code: calculateItemCode(d).trim() || clean.product_code, roll_count: t.roll_count, width_mm: t.width_mm, print_val_size_mm: t.print_val_size_mm, order_kg: t.kg, base_length: this.state.result?.results[0]?.rounded_length ?? null, duplicate_rezka_labels: d.duplicateLabels, include_bobina_in_net: d.includeBobina, standard_print_side: this.sideForSave };
        const result = await adminSaveProductionMapWithOrder(this.session, map, { ...t, order_number: '', source_map_id: sourceId }, '', d.fork ? 'fork' : 'use', this.guard);
        if (!this.current() || !this.store.isCurrentScope(scope))
            return;
        if (result.template) {
            this.store.remember(result.template, { scope });
            this.draft({ templateId: result.template.id, orderCode: result.template.code, sourceMapId: result.template.source_map_id, fork: false, variantId: result.template.variant_id });
        }
        this.savedRequestId = '';
        this.savedRequestSignature = '';
        this.draft({ duplicateLabels: false, includeBobina: false, standardSide: null, rememberedSide: result.saved.map.standard_print_side });
        if (this.printSideTimer)
            clearTimeout(this.printSideTimer);
        this.printSideRead++;
        this.notice(this.a('calculate.order_opened', { order: result.saved.map.order_number.trim() }), 'success');
    }
    catch (error) {
        if (this.current() && !this.missingMap(error))
            this.notice(this.operationError(error, 'calculate.order_open_failed'), 'error');
    }
    finally {
        this.patch({ openingSaved: false });
    } };
    pickImage = async () => { if (!this.interactive() || this.state.uploadingImage)
        return; const picked = await this.actions.pickImage(); if (!picked || !this.current())
        return; this.patch({ uploadingImage: true, error: '' }); this.draft({ imageLocalPath: picked.uri }); try {
        const image = await uploadCalculateOrderImage(this.session, picked.bytes, picked.filename, this.guard);
        if (!this.current())
            return;
        this.draft({ imageId: image.image_id, imageName: image.image_name, imageMime: image.image_mime, imageSize: image.image_size_bytes, imageUrl: image.image_url, imageLocalPath: '' });
    }
    catch (error) {
        this.draft({ imageLocalPath: '' });
        this.patch({ error: error instanceof MobileApiException ? error.message : String(error) });
        if (this.current())
            this.notice(this.a('calculate.image_upload_failed'), 'error');
    }
    finally {
        this.patch({ uploadingImage: false });
    } };
    clearImage = () => { if (this.interactive())
        this.draft({ imageId: '', imageName: '', imageMime: '', imageSize: 0, imageUrl: '', imageLocalPath: '' }); };
    openAutomatic = async () => { if (!this.interactive() || this.state.openingAuto || this.state.openingSaved || this.args.openedOrder || this.args.pendingOrderId || this.args.trainingMode || !this.requireFresh() || !this.templateValid())
        return; this.patch({ openingAuto: true }); const scope = this.store.captureScope(); try {
        const d = this.state.draft, result = await adminAutoOpenProductionMap(this.session, this.template(), d.duplicateLabels, d.includeBobina, this.sideForSave, this.guard);
        if (!this.current() || !this.store.isCurrentScope(scope))
            return;
        if (result.template)
            this.store.remember(result.template, { scope });
        this.notice(this.a('calculate.order_opened', { order: result.saved.map.order_number }), 'success');
        this.actions.back(true);
    }
    catch (error) {
        if (this.current())
            this.notice(this.operationError(error, 'calculate.auto_open_failed'), 'error');
    }
    finally {
        this.patch({ openingAuto: false });
    } };
    saveOpened = async () => { const source = this.args.openedOrder; if (!this.interactive() || !source || this.state.savingOpened || !this.fresh || !this.formErrors())
        return; this.patch({ savingOpened: true, error: '' }); try {
        await adminSaveOpenedOrderEdit(this.session, source, this.template(), this.guard);
        if (this.current())
            this.actions.back(true);
    }
    catch (error) {
        if (this.current()) {
            const reason = openedOrderEditErrorReason(error);
            this.patch({ error: reason });
            await this.presentations.request('openedOrderError', { reason, orderNumber: source.template.order_number });
        }
    }
    finally {
        this.patch({ savingOpened: false });
    } };
    override dispose() { super.dispose(); this.printSideRead++; if (this.printSideTimer)
        clearTimeout(this.printSideTimer); this.presentations.dispose(); }
}
