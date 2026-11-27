export interface ProbeHost {
  parent?:ProbeHost;
  gameengineProbe?:{state?:unknown};
  postMessage?:(message:unknown,targetOrigin:string)=>void;
}
const defaultHost=globalThis as unknown as ProbeHost;
function transport(host:ProbeHost):ProbeHost|null {
  try{
    const parent=host.parent;
    const target=parent&&parent!==host?parent:host;
    return typeof target.gameengineProbe?.state==='function'&&typeof target.postMessage==='function'?target:null;
  }catch(error){
    // A public parent API may be unavailable across an origin boundary. Do not
    // hide implementation defects, such as an unexpected TypeError getter.
    if(typeof error==='object'&&error!==null&&(error as {name?:unknown}).name==='SecurityError')return null;
    throw error;
  }
}
export function environmentDiagnosticsEnabled(host:ProbeHost=defaultHost):boolean{return transport(host)!==null;}
/** Outbound owned values only. Caller supplies an owned snapshot, never SIM or
 * typed-array references. Telemetry is not proof of actual GPU pixels. */
export function publishEnvironmentDiagnostics(snapshot:Readonly<Record<string,unknown>>,host:ProbeHost=defaultHost):void {
  transport(host)?.postMessage?.(Object.freeze({type:'outrun-environment-diagnostics',version:1,snapshot}),'*');
}
