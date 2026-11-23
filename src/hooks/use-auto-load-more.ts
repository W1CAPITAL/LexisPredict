"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {nextAutoListCount} from "@/lib/auto-list-pagination";

type AutoLoadMoreOptions={
 initialCount?:number;
 step?:number;
 rootSelector?:string;
 rootMargin?:string;
 resetKey?:string|number;
};

/**
 * Expands long lists as the user scrolls near their end. It renders in small
 * batches to keep low-memory desktop installations responsive; a single
 * "show all" action remains available as an accessible fallback.
 */
export function useAutoLoadMore(
 total:number,
 {
  initialCount=40,
  step=40,
  rootSelector,
  rootMargin="900px 0px",
  resetKey,
 }:AutoLoadMoreOptions={}
){
 const safeTotal=Number.isFinite(total)?Math.max(0,Math.floor(total)):0;
 const safeInitial=Number.isFinite(initialCount)?Math.max(0,Math.floor(initialCount)):0;
 const safeStep=Number.isFinite(step)?Math.max(1,Math.floor(step)):1;
 const [visibleCount,setVisibleCount]=useState(()=>Math.min(safeTotal,safeInitial));
 const sentinelRef=useRef<HTMLDivElement|null>(null);

 useEffect(()=>{
  setVisibleCount(Math.min(safeTotal,safeInitial));
 },[safeTotal,safeInitial,resetKey]);

 useEffect(()=>{
  const target=sentinelRef.current;
  if(!target||visibleCount>=safeTotal||typeof IntersectionObserver==="undefined")return;
  const root=rootSelector?document.querySelector(rootSelector):null;
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){
    setVisibleCount(current=>nextAutoListCount(current,safeTotal,safeStep));
   }
  },{root,rootMargin});
  observer.observe(target);
  return ()=>observer.disconnect();
 },[visibleCount,safeTotal,safeStep,rootSelector,rootMargin,resetKey]);

 const showAll=useCallback(()=>setVisibleCount(safeTotal),[safeTotal]);
 return {visibleCount,sentinelRef,showAll,setVisibleCount};
}
