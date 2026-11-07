// Extension contracts; Sprint 3 Organic runs before calibrated projection.
import type {MotionFrame} from '../engine/types';
import type {ProjectionImage,ProjectionConfig} from './model';
export type ProjectionContext={motion:MotionFrame;technicalTime:number;artisticDelayMs:number};
export interface ShapeEngine {process(image:ProjectionImage,context:ProjectionContext):ProjectionImage;reset():void;}
export interface TimeEngine {push(image:ProjectionImage):void;sample(at:number,delayMs:number):ProjectionImage|null;clear():void;}
export interface ArchiveFusion {compose(body:ProjectionImage,context:ProjectionContext):ProjectionImage;dispose():void;}
export interface DataMapping {map(data:unknown,context:ProjectionContext):Partial<ProjectionConfig>;}
export interface CueSystem {recall(id:string):ProjectionConfig;}
// Sprint 4 can add image material or semantic control without opening another camera.
export interface OrganicArchiveFusion {compose(surface:import('./organic/engine').OrganicSurface,material:unknown,context:ProjectionContext):import('./organic/engine').OrganicSurface;dispose():void;}
export interface OrganicDataMapping {map(data:unknown,context:ProjectionContext):Partial<import('./organic/config').OrganicConfig>;}
