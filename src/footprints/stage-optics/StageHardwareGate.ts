/**
 * Deliberate release guard for optical-stage outputs. Development can be used
 * to commission a rig on a supervised local computer. Production builds retain
 * the Studio planning/preview UI while opening physical projectors is disabled
 * unless explicitly enabled through a build-time environment variable.
 *
 * Physical QA in S5.7.4 and S5.7.5 is still mandatory after enabling.
 */
export function stageHardwareAvailable(isDev:boolean,explicitOptIn:string|undefined):boolean{
 return isDev||explicitOptIn==='enabled';
}
