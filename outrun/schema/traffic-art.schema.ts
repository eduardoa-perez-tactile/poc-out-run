import {resource,bool,u32} from '@gameengine/schema';
// Renderer-owned pins survive scene-owned traffic removal and reconcile rebuilds.
export const TrafficArtResidency=resource('TrafficArtResidency',{loaded:bool(),reconciled:bool(),catalogLoaded:bool(),catalogReconciled:bool()},{sim:false});
// Internal art fixtures are presentation data, never traffic simulation inputs.
// mode0 gameplay, mode1 catalog, mode2 controlled compositor/occlusion fixture.
export const TrafficArtPreview=resource('TrafficArtPreview',{mode:u32(),frame:u32({default:1}),caseId:u32()},{sim:false});
