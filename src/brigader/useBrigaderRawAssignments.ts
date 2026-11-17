import { useEffect,useMemo } from 'react';
import { useMaterialAssignments,type MaterialAssignmentBinding } from '../material/useMaterialAssignments';
import { BrigaderPresentations } from './brigaderPresentations';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderNotice } from './useBrigaderNotice';
export function useBrigaderRawAssignments(route:string,initialBarcode:string){const page=useBrigaderFeature(route),{current,shell}=page,notice=useBrigaderNotice(),binding=useMemo<MaterialAssignmentBinding>(()=>({session:shell.session,witness:shell.witness,current,groupScopeReady:true,apparatusFilterEnabled:false}),[shell.session,shell.witness,current]),model=useMaterialAssignments(initialBarcode,binding),presentations=useMemo(()=>new BrigaderPresentations(current),[current]);useEffect(()=>()=>presentations.dispose(),[presentations]);useEffect(()=>{if(model.state.notice&&current())notice(model.state.notice,model.state.noticeTone);},[model.state.notice,model.state.noticeRevision,model.state.noticeTone,notice,current]);return{...model,page,presentations};}
