interface ProbeHost {
  parent?:ProbeHost;
  gameengineProbe?:{state?:unknown};
  postMessage?:(message:unknown,targetOrigin:string)=>void;
}
function transport():ProbeHost|null {
  const host=globalThis as unknown as ProbeHost;
  try{
    const target=host.parent&&host.parent!==host?host.parent:host;
    return typeof target.gameengineProbe?.state==='function'&&typeof target.postMessage==='function'?target:null;
  }catch{return null;}
}
export function environmentDiagnosticsEnabled():boolean{return transport()!==null;}
/** Outbound owned values only. No commands or SIM/typed-array references are
 * exposed. Telemetry is never accepted as proof of actual GPU pixels. */
export function publishEnvironmentDiagnostics(snapshot:Readonly<Record<string,unknown>>):void {
  transport()?.postMessage?.({type:'outrun-environment-diagnostics',version:1,snapshot},'*');
}
