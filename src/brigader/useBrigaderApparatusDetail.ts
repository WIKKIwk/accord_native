import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';
import type { FactoryMapObjectSelection } from '../admin/AdminFactoryMapViewer';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderApparatusController } from './brigaderApparatusController';
export function useBrigaderApparatusDetail(parent:BrigaderApparatusController,id:string) {
  const page = useBrigaderFeature(appRoutes.adminApparatusSettings), notice = useBrigaderNotice(), { current,interactive,shell } = page;
  const [seed] = useState(() => { const source = parent.getSnapshot(); if (!source.options) throw Error('Original apparatus catalog missing'); return { apparatus:source.apparatus,collections:source.collections,options:source.options,trainingAvailable:source.trainingAvailable }; });
  const owner = useMemo(() => new BrigaderApparatusController(shell.session,'catalog',false,current,interactive,notice,() => localeController.locale,parent.accept,seed),[shell.session,current,interactive,notice,parent,seed]);
  const state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot), [busy,setBusy] = useState({ placement:false,training:false,material:false });
  useEffect(() => { const detach = owner.attach(() => {}), stop = subscribeSessionWitness(() => { if (!shell.isCurrent()) owner.dispose(); }); return () => { stop(); detach(); }; },[owner,shell]);
  const item = state.apparatus.find(item => item.id === id);
  const setTraining = async (enabled:boolean) => { if (!item || busy.training || !interactive()) return; setBusy(value => ({ ...value,training:true })); try { await owner.training(item,enabled); } finally { if (current()) setBusy(value => ({ ...value,training:false })); } };
  const setMaterial = async (enabled:boolean) => { if (!item || busy.material || !interactive()) return; setBusy(value => ({ ...value,material:true })); try { await owner.materialAssignment(item,enabled); } finally { if (current()) setBusy(value => ({ ...value,material:false })); } };
  const placement = async (clear:boolean) => {
    if (!item || busy.placement || !interactive() || clear && !item.factory_map_object_id) return;
    setBusy(value => ({ ...value,placement:true }));
    try { if (clear) { if (await owner.presentations.request<boolean>('unlink',item.name) !== true || !current()) return; await owner.placement(item,''); }
      else { const selection = await owner.presentations.request<FactoryMapObjectSelection>('mapObject',{ initialObjectId:item.factory_map_object_id }); if (selection && current()) await owner.placement(item,selection.objectId); }
    } finally { if (current()) setBusy(value => ({ ...value,placement:false })); }
  };
  return { page,owner,state,item,busy,setTraining,setMaterial,placement };
}
