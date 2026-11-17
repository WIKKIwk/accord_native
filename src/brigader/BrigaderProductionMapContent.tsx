import { canonicalApparatusGroups } from './brigaderApparatusController';
import { productionApparatusMatchesMap } from './productionMapApparatusPolicy';
import { useMemo } from 'react';
import { View } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { AdminCreateMenu } from '../admin/AdminCreateMenu';
import type { AdminMenuAction } from '../admin/adminCreateMenuController';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { BrigaderBottomBar } from './BrigaderBottomBar';
import { BrigaderActionIcon } from './BrigaderActionIcon';
import { BrigaderProductionCanvas } from './BrigaderProductionCanvas';
import { BrigaderPresentationHost } from './BrigaderPresentationHost';
import { BrigaderProductionMapDialog } from './BrigaderProductionMapDialogs';
import { productionGroupLabel } from './productionMapGroupLabel';
import { useBrigaderProductionMap } from './useBrigaderProductionMap';
export function BrigaderProductionMapContent() {
    const { page, owner, state } = useBrigaderProductionMap(), actions = useMemo<AdminMenuAction[]>(() => { const task: AdminMenuAction = { id: 'task', label: 'Ishlov', icon: { ios: 'person.fill', android: 'engineering' }, onPress: () => { void owner.add('task'); } }; if (state.loading)
        return [{ id: 'loading', label: 'Aparatlar yuklanmoqda', icon: { ios: 'hourglass', android: 'hourglass_top' }, enabled: false, onPress: () => { } }, task]; if (state.error)
        return [{ id: 'reload', label: 'Aparatlarni qayta yuklash', icon: { ios: 'arrow.clockwise', android: 'refresh' }, onPress: () => { void owner.loadCatalog(); } }, task]; const available = canonicalApparatusGroups(state.catalog).filter(group => group.key !== 'unclassified' && (owner.isLamination(group) || group.apparatus.some(item => productionApparatusMatchesMap(item, owner.args.orderContext, state.nodes, state.catalog)))); const groups = available.map<AdminMenuAction>(group => ({ id: group.key, label: productionGroupLabel(group.key, page.locale), icon: { ios: group.key === 'cut' ? 'scissors' : 'gearshape.2', android: group.key === 'print' ? 'print' : group.key === 'cut' ? 'content_cut' : group.key === 'package' ? 'inventory_2' : group.key === 'glue' ? 'water_drop' : 'layers' }, enabled: !owner.blocked(group), onPress: () => { void owner.addGroup(group); } })); const extras: AdminMenuAction[] = !owner.orderMode ? [{ id: 'formula', label: 'Formula', icon: { ios: 'function', android: 'functions' }, onPress: () => { void owner.add('formula'); } }, { id: 'condition', label: 'Condition', icon: { ios: 'arrow.triangle.branch', android: 'call_split' }, onPress: () => { void owner.add('condition'); } }] : []; const fallback: AdminMenuAction = { id: 'empty', label: 'Mos aparatlar topilmadi', icon: { ios: 'gearshape.2', android: 'precision_manufacturing' }, enabled: false, onPress: () => { } }; return [...(groups.length ? groups : [fallback]), task, ...extras]; }, [owner, state.loading, state.error, state.catalog, state.nodes, page.locale]);
    return <BrigaderFeatureFrame route={appRoutes.adminProductionMapTest} title={owner.title} hideProfile onBack={owner.close} footer={<BrigaderBottomBar active="home" primary={false}/>} actions={(owner.orderMode || owner.args.templateOnly) && !owner.args.readOnly ? <BrigaderActionIcon label="Saqlash" icon={{ ios: state.saving ? 'hourglass' : 'square.and.arrow.down', android: state.saving ? 'hourglass_top' : 'save' }} onPress={() => { void owner.save(); }}/> : undefined}><View style={{ flex: 1 }}><BrigaderProductionCanvas owner={owner}/>{!owner.args.readOnly ? <AdminCreateMenu actions={actions} isCurrent={page.interactive} openLabel="Element qo‘shish" closeLabel="Yopish" alignEnd={false} columns={2} bottomOffset={12}/> : null}</View><BrigaderPresentationHost owner={owner.presentations} sheet={() => true} options={entry => entry.kind === 'orderConfirm' ? { scrim: .32, maxWidth: 430 } : { scrim: .32 }} render={(entry, interactive) => <BrigaderProductionMapDialog entry={entry} owner={owner.presentations} interactive={interactive} locale={page.locale}/>}/></BrigaderFeatureFrame>;
}
