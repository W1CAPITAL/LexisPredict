import { MousePointer2 } from 'lucide-react';

/**
 * Três cursores decorativos próprios, inspirados em colaboração visual.
 * Sem canvas, áudio, script de extensão, leitura do DOM ou processamento em loop.
 * O componente só existe enquanto um fallback/skeleton está montado.
 */
export function SwarmLoadingIndicator({compact=false}:{compact?:boolean}){
 return <span data-lexis-swarm-loading data-compact={compact?'true':'false'} aria-hidden="true">
   <span className="lx-mini-swarm-outline" />
   {(['a','b','c'] as const).map((agent)=><span key={agent} className={'lx-mini-swarm-actor lx-mini-swarm-'+agent}>
     <MousePointer2 size={compact?12:14} strokeWidth={2.2} />
   </span>)}
 </span>;
}
