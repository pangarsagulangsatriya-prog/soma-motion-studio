export type ActorChannel='A'|'B';
export type FootSide='left'|'right';
export type ActorPalette={A:string;B:string};
export type FootColorOverrides=Partial<Record<ActorChannel,Partial<Record<FootSide,string>>>>;
export type FootVisibility=Record<ActorChannel,Record<FootSide,boolean>>;

export const DEFAULT_ACTOR_PALETTE:ActorPalette={A:'#E44F32',B:'#242424'};
export const DEFAULT_FOOT_VISIBILITY:FootVisibility={
 A:{left:true,right:true},B:{left:true,right:true}
};
const HEX=/^#[0-9a-f]{6}$/i;
const safe=(color:string,fallback:string)=>HEX.test(color)?color:fallback;
export function actorChannel(actorId:string):ActorChannel{
 return actorId==='B'||actorId==='performer-2'?'B':'A';
}
/** Actor identity always owns the primary color; foot override is deliberate. */
export function resolveActorColor(
 actorId:string,foot:FootSide,
 palette:ActorPalette,footOverrides:FootColorOverrides,
 background:'#F5F5F2'|'#111512'
):string{
 const actor=actorChannel(actorId);
 const override=footOverrides[actor]?.[foot];
 if(override&&HEX.test(override))return override;
 const chosen=safe(palette[actor],DEFAULT_ACTOR_PALETTE[actor]);
 // Only the factory charcoal gets an automatic contrast switch;
 // an explicitly customised color must remain exactly as the user chose it.
 if(actor==='B'&&background==='#111512'&&
  chosen.toLowerCase()===DEFAULT_ACTOR_PALETTE.B.toLowerCase())return '#D8D6D0';
 return chosen;
}
export interface LegacyFootSettings{
 colors?:{left?:string;right?:string};
 visible?:{left?:boolean;right?:boolean};
}
/** Never silently reinterpret old left/right color as A/B.
 * Existing colors stay as explicit A/B foot overrides. */
export function migrateLegacyFootStyle(legacy:LegacyFootSettings):{
 actorColors:ActorPalette;footOverrides:FootColorOverrides;footVisible:FootVisibility
}{
 const footOverrides:FootColorOverrides={};
 const footVisible:FootVisibility={
  A:{left:legacy.visible?.left??true,right:legacy.visible?.right??true},
  B:{left:legacy.visible?.left??true,right:legacy.visible?.right??true}
 };
 const override:Partial<Record<FootSide,string>>={};
 if(legacy.colors?.left&&HEX.test(legacy.colors.left))override.left=legacy.colors.left;
 if(legacy.colors?.right&&HEX.test(legacy.colors.right))override.right=legacy.colors.right;
 if(Object.keys(override).length){footOverrides.A={...override};footOverrides.B={...override};}
 return {actorColors:{...DEFAULT_ACTOR_PALETTE},footOverrides,footVisible};
}
