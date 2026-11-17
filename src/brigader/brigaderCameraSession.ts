import type { CameraView,PermissionResponse } from 'expo-camera';
type State={wanted:boolean;ready:boolean;generation:number;error:unknown};
/** The scanner adapter resolves start only from a real CameraView ready event. */
export class BrigaderCameraSession {
 private state:State={wanted:false,ready:false,generation:0,error:null};private listeners=new Set<()=>void>();private handle:CameraView|null=null;private committed=false;private leases=0;private retired=false;private permission:PermissionResponse|null=null;private permissionError:unknown=null;
 private starting:{resolve:()=>void;reject:(error:unknown)=>void}[]=[];private stopped:(()=>void)[]=[];
 constructor(private readonly original:()=>boolean){}
 getSnapshot=()=>this.state;subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 current=()=>!this.retired&&this.leases>0&&this.original();
 private patch(change:Partial<State>){if(this.retired)return;this.state={...this.state,...change};this.listeners.forEach(listener=>listener());}
 mount(){this.leases++;return()=>{this.leases--;queueMicrotask(()=>{if(!this.leases)this.dispose();});};}
 permissionChanged(permission:PermissionResponse|null,error:unknown){this.permission=permission;this.permissionError=error;if(this.state.wanted&&(error||permission&&!permission.granted)){this.failed(error??new Error('Camera permission denied'));}}
 start=():Promise<void>=>{if(!this.current())return Promise.reject(new Error('Camera owner expired'));if(this.permissionError||this.permission&&!this.permission.granted)return Promise.reject(this.permissionError??new Error('Camera permission denied'));if(this.state.wanted&&this.state.ready&&this.handle)return Promise.resolve();return new Promise((resolve,reject)=>{this.starting.push({resolve,reject});if(!this.state.wanted)this.patch({wanted:true,ready:false,error:null,generation:this.state.generation+1});});};
 stop=async()=>{const handle=this.handle;const pending=this.starting.splice(0);pending.forEach(item=>item.reject(new Error('Camera start cancelled')));this.patch({wanted:false,ready:false});const detached=!this.committed?Promise.resolve():new Promise<void>(resolve=>this.stopped.push(resolve));if(handle)await handle.pausePreview();await detached;};
 nativeRef=(handle:CameraView|null)=>{this.handle=handle;if(handle&&!this.state.wanted)void handle.pausePreview().catch(()=>{});};
 committedActive(active:boolean){this.committed=active;if(!active)this.stopped.splice(0).forEach(resolve=>resolve());}
 ready=()=>{if(!this.current()||!this.state.wanted||!this.handle||!this.permission?.granted)return;this.patch({ready:true,error:null});this.starting.splice(0).forEach(item=>item.resolve());};
 failed=(error:unknown)=>{if(!this.current())return;this.patch({ready:false,error});this.starting.splice(0).forEach(item=>item.reject(error));};
 dispose(){if(this.retired)return;this.retired=true;this.state={...this.state,wanted:false,ready:false};const handle=this.handle;this.handle=null;if(handle)void handle.pausePreview().catch(()=>{});this.starting.splice(0).forEach(item=>item.reject(new Error('Camera owner retired')));this.stopped.splice(0).forEach(resolve=>resolve());this.listeners.clear();}
}
