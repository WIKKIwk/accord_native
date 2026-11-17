import { useCallback,useMemo,useState } from 'react';
import type { Session } from '../auth';
import { adminProductionMapQueueSnapshot } from '../productionMapQueueSnapshotApi';
import { adminRawMaterialAssignments,adminRawMaterialStartRequirements } from '../workerRawMaterials';
import { qolipProductMolds } from '../qolipCatalogApi';
import { materialDetailMolds,type MaterialDetailOrder } from '../material/materialTaskDetailSections';
import { materialQueueControlConsistent } from '../material/materialTaskMapModel';
import { dartFutureTimeout } from '../shared/dartFutureTimeout';
import { productionText } from '../shared/localization';
import type { FactoryMapSnapshot } from '../admin/factoryMapStatus';
/** Source non-worker read-only detail: no hidden worker bootstrap, WIP or mold-start requests. */
export function useBrigaderFactoryDetailReaders(session:Session,orderId:string,apparatus:string,current:()=>boolean,showNotice:(message:string,tone:'error'|'success')=>void,locale:string){
 const[freshSnapshot,setFreshSnapshot]=useState<FactoryMapSnapshot|null>(null);
 const control=useMemo(()=>{let request:Promise<{scanRequired:boolean}>|undefined;return()=>request??=(async()=>{try{const value=await dartFutureTimeout(adminProductionMapQueueSnapshot(session,{apparatus,order_id:orderId,current}),5000);if(!current())return{scanRequired:false};setFreshSnapshot(value);const action=value.queue_action_controls?.[apparatus]?.[orderId],orderControl=value.order_controls?.[orderId]??'active',queueState=value.queue_states?.[apparatus]?.[orderId]??null,synchronized=!!action&&materialQueueControlConsistent(action,orderControl,queueState);if(!synchronized)showNotice(productionText('worker.error.sync',locale),'error');return{scanRequired:synchronized&&action.interaction?.start_materials_mode==='scan_required'};}catch{if(current())showNotice(productionText('worker.error.sync',locale),'error');return{scanRequired:false};}})();},[session,apparatus,orderId,current,showNotice,locale]);
 const readAssignments=useCallback(async(full:MaterialDetailOrder,guard:()=>void)=>{const contract=await control();guard();if(contract.scanRequired){const requirements=await dartFutureTimeout(adminRawMaterialStartRequirements(session,full.map.id,apparatus,[],guard),5000);guard();return requirements.assignments.filter(row=>row.apparatus.trim()===apparatus);}return dartFutureTimeout(adminRawMaterialAssignments(session,full.map.id,apparatus,undefined,{beforeSend:guard}),5000);},[session,apparatus,control]);
 const readMolds=useCallback(async(full:MaterialDetailOrder,guard:()=>void)=>{await control();guard();if(!full.map.product_code.trim())return[];const rows=await qolipProductMolds(session,full.map.product_code,()=>{guard();return true;});guard();return materialDetailMolds(rows);},[session,control]);
 return{readAssignments,readMolds,freshSnapshot};
}
