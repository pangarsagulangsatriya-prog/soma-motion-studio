/** Resolume bridge contract.
 * A static browser cannot publish a native Syphon or Spout sender.
 * OBS captures our live popup window and publishes a native sender via a local plugin.
 * No UI here claims that Resolume itself has connected. */
export type ResolumeHostPlatform='mac'|'windows'|'other';
export type NativeVideoTransport='Syphon'|'Spout'|'Native bridge unavailable';

export type ResolumeBridgeRecipe={
 platform:ResolumeHostPlatform;
 transport:NativeVideoTransport;
 obsCapture:string;
 obsOutput:string;
 resolumeSource:string;
 pluginUrl:string|null;
 pluginName:string;
 supportsNativeSender:boolean;
};

export const RESOLUME_BRIDGE_DOCS={
 resolume:'https://resolume.com/support/en/syphonspout',
 mac:'https://github.com/ryrotella/obs-syphon-plugin',
 windows:'https://github.com/Off-World-Live/obs-spout2-plugin'
} as const;

export function detectResolumeHostPlatform(agent:string):ResolumeHostPlatform{
 const text=agent.toLowerCase();
 if(/windows|win32|win64/.test(text))return 'windows';
 if(/macintosh|mac os|macintel|macos|darwin/.test(text))return 'mac';
 return 'other';
}

export function getResolumeBridgeRecipe(platform:ResolumeHostPlatform):ResolumeBridgeRecipe{
 if(platform==='mac')return {
  platform,transport:'Syphon',
  obsCapture:'macOS Screen Capture → Window Capture (Chrome · SOMA FEED)',
  obsOutput:'OBS → Tools → Syphon Output atau Syphon Filter per sumber',
  resolumeSource:'Resolume → Sources → Syphon → OBS sender',
  pluginUrl:RESOLUME_BRIDGE_DOCS.mac,pluginName:'OBS Syphon',supportsNativeSender:true
 };
 if(platform==='windows')return {
  platform,transport:'Spout',
  obsCapture:'OBS → Window Capture → SOMA FEED',
  obsOutput:'OBS → Tools → Spout2 atau Spout Filter per sumber',
  resolumeSource:'Resolume → Sources → Spout → OBS sender',
  pluginUrl:RESOLUME_BRIDGE_DOCS.windows,pluginName:'OBS Spout2',supportsNativeSender:true
 };
 return {
  platform,transport:'Native bridge unavailable',
  obsCapture:'Capture jendela SOMA FEED di OBS',
  obsOutput:'Pilih plugin video lokal sesuai sistem operasi',
  resolumeSource:'Resolume → Sources → Syphon / Spout',
  pluginUrl:null,pluginName:'OBS bridge',supportsNativeSender:false
 };
}

export function getPerformRouteDescription(route:'soma'|'resolume'):string{
 return route==='soma'
  ?'SOMA → fullscreen proyektor · Map QA + LIVE'
  :'SOMA Clean Feed → OBS → Syphon/Spout → Resolume';
}
