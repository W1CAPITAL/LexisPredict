"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { resolveMotionCapacity } from "@/lib/fluid-motion-policy";
type ResourceNavigator = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
export function FluidMotionController() {
 const pathname=usePathname();const previousPath=useRef<string|null>(null);
 useEffect(()=>{
  const mq=window.matchMedia("(prefers-reduced-motion: reduce)");
  const recalculate=()=>{const device=navigator as ResourceNavigator;document.documentElement.dataset.lexisMotion=resolveMotionCapacity({reducedMotion:mq.matches,saveData:Boolean(device.connection?.saveData),deviceMemory:device.deviceMemory,hardwareConcurrency:device.hardwareConcurrency});};
  recalculate();mq.addEventListener?.("change",recalculate);return()=>mq.removeEventListener?.("change",recalculate);
 },[]);
 useEffect(()=>{
  if(!pathname)return;const changed=previousPath.current!==null&&previousPath.current!==pathname;previousPath.current=pathname;
  if(!changed||/^(\/login|\/signup|\/primeiro-acesso)(\/|$)/.test(pathname))return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const lite=document.documentElement.dataset.lexisMotion==="lite";document.body.dataset.lexisRouteArrival="1";
  const timer=window.setTimeout(()=>{delete document.body.dataset.lexisRouteArrival;},lite?190:380);
  return()=>{window.clearTimeout(timer);delete document.body.dataset.lexisRouteArrival;};
 },[pathname]);
 return null;
}
