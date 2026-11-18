/** VIS-R3 — 14 canonical FLOOR IDs, fourteen distinct footprint-first visual recipes.
 * The original scene names and IDs stay compatible with previous presets.
 * These parameters affect software visual synthesis only.
 */
import {FLOOR_SCENES,type FloorSceneId} from './sceneRegistry.ts';
import type {ArtisticFootprintStyle} from './ArtisticFootprintRuntime.ts';

export type CatalogSceneId='footprints'|FloorSceneId;
export type CatalogMotif='contour'|'snow'|'stitch'|'lantern'|'root'|'shard'|'swarm'|'veil'|'smoke'|'fracture'|'current'|'burst'|'splash'|'glow';
export type CatalogRecipe={
 id:CatalogSceneId;title:string;subtitle:string;style:ArtisticFootprintStyle;
 motif:CatalogMotif;ink:string;paper:string;accent:string;
 trigger:'contact'|'movement'|'presence'|'mixed';
 persistence:number;scale:number;pathWeight:number;
};
type Detail=Omit<CatalogRecipe,'id'|'title'|'trigger'>;
const DETAILS:Record<CatalogSceneId,Detail>={
 'footprints':{subtitle:'Lines crossing their own history',style:'trace',motif:'contour',ink:'#dddcd2',paper:'#090b0b',accent:'#9eb5a5',persistence:.84,scale:.94,pathWeight:.72},
 'snowfall':{subtitle:'Pressed strata slowly close',style:'negative-memory',motif:'snow',ink:'#f1efe6',paper:'#19232b',accent:'#a8c5cc',persistence:.62,scale:1,pathWeight:.33},
 'christmas':{subtitle:'Sparse footlit stitches',style:'trace',motif:'stitch',ink:'#d8e5ca',paper:'#101c17',accent:'#d8bc79',persistence:.75,scale:.78,pathWeight:.65},
 'hanukkah':{subtitle:'Eight echoes of a contact',style:'wave-record',motif:'lantern',ink:'#b3cfe5',paper:'#101624',accent:'#f4d7a3',persistence:.7,scale:.75,pathWeight:.5},
 'spring-garden':{subtitle:'Root lines under footsteps',style:'trace',motif:'root',ink:'#a5c7ae',paper:'#07120e',accent:'#d8d5a7',persistence:.83,scale:1.05,pathWeight:.95},
 'fall-leaves':{subtitle:'Broken lines from crossing paths',style:'compression',motif:'shard',ink:'#c8b39b',paper:'#17100d',accent:'#a86a4c',persistence:.62,scale:.9,pathWeight:.68},
 'the-swarm':{subtitle:'Grain displaced by walking',style:'compression',motif:'swarm',ink:'#c4c9b8',paper:'#101716',accent:'#86a49b',persistence:.56,scale:1.04,pathWeight:.4},
 'ectoplasmic-fog':{subtitle:'Absence opens in soft veils',style:'negative-memory',motif:'veil',ink:'#d1e2db',paper:'#102022',accent:'#8ab5aa',persistence:.72,scale:1.2,pathWeight:.38},
 'ground-smoke':{subtitle:'Low bands trail each contact',style:'wave-record',motif:'smoke',ink:'#d2d2cf',paper:'#10131a',accent:'#9da4a7',persistence:.52,scale:1.05,pathWeight:.82},
 'cursed-fluid':{subtitle:'Fracture radiates from a step',style:'negative-memory',motif:'fracture',ink:'#c9aabe',paper:'#1a101c',accent:'#806d93',persistence:.76,scale:.94,pathWeight:.55},
 'living-water':{subtitle:'Multiple time-rings on one path',style:'wave-record',motif:'current',ink:'#a6d4d3',paper:'#081820',accent:'#438e9c',persistence:.69,scale:1.3,pathWeight:.42},
 'fireworks':{subtitle:'One radial burst per confirmed step',style:'compression',motif:'burst',ink:'#eadbb7',paper:'#0b1118',accent:'#bc9c6e',persistence:.35,scale:.95,pathWeight:.12},
 'pool-splash':{subtitle:'A contact interrupts repeated rings',style:'wave-record',motif:'splash',ink:'#b0d8e9',paper:'#0b1a20',accent:'#6d9ab1',persistence:.5,scale:1.1,pathWeight:.42},
 'fireflies':{subtitle:'Stationary traces, sparse firefly halos',style:'trace',motif:'glow',ink:'#d4dfb0',paper:'#0e1813',accent:'#a0ae6a',persistence:.89,scale:.7,pathWeight:.3}
};
export const ARTISTIC_CATALOG:readonly CatalogRecipe[]=[
 {id:'footprints',title:'Footprints',trigger:'contact',...DETAILS.footprints},
 ...FLOOR_SCENES.map(scene=>({
  id:scene.id,title:scene.name,trigger:scene.trigger,...DETAILS[scene.id]
 }))
];
export const catalogRecipe=(id:CatalogSceneId):CatalogRecipe=>
 ARTISTIC_CATALOG.find(item=>item.id===id)??ARTISTIC_CATALOG[0];
export function validateCatalogSceneId(raw:unknown):raw is CatalogSceneId{
 return typeof raw==='string'&&ARTISTIC_CATALOG.some(item=>item.id===raw);
}
/** Small distinct SVG thumbnail, deterministic and external-asset-free.
 * Returned SVG contains only source-owned numeric and palette parameters. */
export function catalogThumbnailSvg(recipe:CatalogRecipe):string{
 const mid=recipe.motif==='burst'?'M32 9V55 M9 32H55 M16 16L48 48 M48 16L16 48':
 recipe.motif==='stitch'?'M18 10l8 15 10 -15 M18 54l8 -15 10 15':
 recipe.motif==='root'?'M30 10V53 M30 34L14 49 M30 27L48 42':
 recipe.motif==='shard'?'M12 14L44 7 27 33 51 47 12 57':
 recipe.motif==='swarm'?'M12 17L27 32 18 46 M45 16L37 37 52 49':
 recipe.motif==='smoke'?'M8 39Q24 16 38 34T59 20 M7 50Q29 30 48 51':
 recipe.motif==='fracture'?'M32 5L25 26 37 33 23 46 32 58':
 recipe.motif==='veil'?'M5 32Q17 12 32 32T59 32 M8 43Q32 18 56 43':
 recipe.motif==='current'?'M6 42Q19 10 32 42T58 42':
 recipe.motif==='glow'?'M32 11V53 M11 32H53':
 recipe.motif==='snow'?'M32 6V58 M6 32H58 M13 13L51 51 M51 13L13 51':
 recipe.motif==='lantern'?'M12 16V48 M20 16V48 M28 16V48 M36 16V48 M44 16V48 M52 16V48':
 recipe.motif==='splash'?'M4 43Q14 14 24 43T44 43T60 43':
 'M18 15L25 49 M38 11L46 50';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'+
 '<rect width="64" height="64" fill="'+recipe.paper+'"/>'+
 '<path d="'+mid+'" fill="none" stroke="'+recipe.accent+'" stroke-width="1.4" opacity=".65"/>'+
 '<ellipse cx="26" cy="29" rx="6" ry="12" transform="rotate(-22 26 29)" fill="none" stroke="'+recipe.ink+'" stroke-width="1.5"/>'+
 '<ellipse cx="40" cy="40" rx="5.5" ry="11" transform="rotate(20 40 40)" fill="none" stroke="'+recipe.ink+'" stroke-width="1.5"/>'+
 '</svg>';
}
