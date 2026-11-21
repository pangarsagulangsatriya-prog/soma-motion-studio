import type {PerformView} from './performCueModel.ts';

export type FinalPreviewSurface='floor'|'body'|'split';

/** Only a software preview choice; no physical projector state is changed. */
export function cueToFinalSurface(view:PerformView):FinalPreviewSurface{
 return view==='body'?'body':view==='split'?'split':'floor';
}
