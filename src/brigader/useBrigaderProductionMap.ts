import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderCalculateStore } from './BrigaderCalculateStore';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderProductionMapArgs } from './brigaderProductionMapArgs';
import { BrigaderProductionMapModel } from './brigaderProductionMapModel';
export function useBrigaderProductionMap() { const page = useBrigaderFeature(appRoutes.adminProductionMapTest), { current, interactive, shell, back, registerBackResult } = page, store = useBrigaderCalculateStore(), notice = useBrigaderNotice(), [args] = useState(() => page.args instanceof BrigaderProductionMapArgs ? page.args : new BrigaderProductionMapArgs()), owner = useMemo(() => new BrigaderProductionMapModel(shell.session, args, store, current, interactive, notice, back), [shell.session, args, store, current, interactive, notice, back]), state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot); useEffect(() => { const detach = owner.attach(() => { void owner.loadCatalog(); }), stop = subscribeSessionWitness(() => { if (!shell.isCurrent())
    owner.dispose(); }); registerBackResult?.(() => owner.getSnapshot().lastSavedTemplate); return () => { stop(); detach(); }; }, [owner, shell, registerBackResult]); return { page, owner, state }; }
