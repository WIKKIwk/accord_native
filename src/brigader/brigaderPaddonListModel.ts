import type { Session } from '../auth';
import { adminPaddonCreate, adminPaddonDelete, adminPaddons } from '../paddonManagementApi';
import { workerPaddonCanDelete, type WorkerPaddon } from '../workerPaddonModel';
import { workerPaddonErrorText } from '../workerPaddonContent';
import { BrigaderModel } from './brigaderModel';
import { BrigaderPresentations } from './brigaderPresentations';
type State = { loading:boolean;hasData:boolean;error:unknown;rows:WorkerPaddon[];creating:boolean;deleting:boolean;refreshing:boolean;canTransfer:boolean };
/** Exact non-operator/Admin-or-Brigader branch of AparatchiPaddonsScreen. */
export class BrigaderPaddonListModel extends BrigaderModel<State> {
  readonly presentations = new BrigaderPresentations(this.current); private generation = 0;
  constructor(private readonly session:Session,readonly apparatus:string,readonly name:string,current:()=>boolean,interactive:()=>boolean,
    private readonly openDetail:(row:WorkerPaddon)=>Promise<void>,private readonly openTransfer:()=>Promise<void>,private readonly message:(text:string)=>void,private readonly p:(key:string,values?:Record<string,unknown>)=>string) {
    super({ loading:true,hasData:false,error:null,rows:[],creating:false,deleting:false,refreshing:false,canTransfer:false },current,interactive);
  }
  load = async () => {
    if (!this.current()) return; const generation = ++this.generation; this.patch({ loading:true,error:null,refreshing:true });
    try { const rows = await adminPaddons(this.session,{ apparatus:this.apparatus,beforeSend:this.guard }); if (!this.current() || generation !== this.generation) return; this.patch({ loading:false,hasData:true,error:null,rows:this.apparatus ? rows.filter(row => row.apparatus_id === this.apparatus) : rows,refreshing:false,canTransfer:true }); }
    catch (error) { if (this.current() && generation === this.generation) this.patch({ loading:false,hasData:false,error,refreshing:false }); }
  };
  open = async (row:WorkerPaddon) => { if (!this.interactive()) return; await this.openDetail(row); if (this.current()) await this.load(); };
  create = async () => { if (!this.interactive() || this.state.creating) return; this.patch({ creating:true }); try { const row = await adminPaddonCreate(this.session,{ apparatus:this.apparatus,beforeSend:this.guard }); this.guard(); await this.open(row); } catch (error) { if (this.current()) this.message(workerPaddonErrorText(error,this.p,'worker.paddon.create_failed')); } finally { this.patch({ creating:false }); } };
  transfer = async () => { if (!this.interactive() || !this.state.canTransfer || this.state.creating || this.state.deleting) return; await this.openTransfer(); if (this.current()) await this.load(); };
  remove = async (row:WorkerPaddon) => {
    if (!this.interactive() || this.state.deleting || !workerPaddonCanDelete(this.session)) return; this.patch({ deleting:true });
    try { if (await this.presentations.request<string>('actions',row) !== 'delete' || !this.current()) return; if (await this.presentations.request<boolean>('delete',row) !== true || !this.current()) return;
      await adminPaddonDelete(this.session,row.code,this.guard); this.guard(); await this.load(); if (this.current()) this.message(this.p('worker.paddon.deleted'));
    } catch (error) { if (this.current()) this.message(workerPaddonErrorText(error,this.p,'worker.paddon.delete_failed')); } finally { this.patch({ deleting:false }); }
  };
  override dispose() { super.dispose(); this.generation++; this.presentations.dispose(); }
}
