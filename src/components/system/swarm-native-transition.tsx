"use client";

import {usePathname} from "next/navigation";
import {useEffect,useRef} from "react";

const SWARM_COLORS=["#F24E1E","#A259FF","#1ABCFE","#0ACF83","#FF7262","#FFC700","#9747FF","#E8467C","#14AE5C","#0D99FF","#FF8A00","#00B5CE"];
type Agent={sx:number;sy:number;tx:number;ty:number;color:string;delay:number;seed:number};

function ease(t:number){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
function drawCursor(ctx:CanvasRenderingContext2D,x:number,y:number,color:string,scale:number){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(5,22);ctx.lineTo(10,14);ctx.lineTo(18,13);ctx.closePath();
 ctx.fillStyle=color;ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle="#fff";ctx.stroke();
 ctx.restore();
}

/** Intro nativa inspirada no Swarm Rebuild: enxame de cursores redesenhando a tela sem ocultar o app. */
export function SwarmNativeTransition(){
 const pathname=usePathname();
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const visited=useRef(new Set<string>());

 useEffect(()=>{
  if(!pathname||visited.current.has(pathname))return;
  visited.current.add(pathname);
  const canvas=canvasRef.current;
  if(!canvas)return;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const saveData=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData===true;
  if(reduced||saveData)return;
  const ctx=canvas.getContext("2d",{alpha:true,desynchronized:true});
  if(!ctx)return;

  let width=0,height=0,dpr=1,raf=0,lastFrame=0,disposed=false;
  const duration=1850;
  const resize=()=>{
   dpr=Math.min(window.devicePixelRatio||1,1.25);
   width=Math.max(1,window.innerWidth);height=Math.max(1,window.innerHeight);
   canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
   canvas.style.width=width+"px";canvas.style.height=height+"px";
   ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  resize();
  const count=width<640?9:16;
  const agents:Agent[]=Array.from({length:count},(_,i)=>{
   const side=i%4;
   const sx=side===0?-32:side===1?width+32:Math.random()*width;
   const sy=side===2?-32:side===3?height+32:Math.random()*height;
   return {sx,sy,tx:width*(0.08+Math.random()*0.84),ty:height*(0.12+Math.random()*0.76),color:SWARM_COLORS[i%SWARM_COLORS.length],delay:(i%5)*0.055,seed:i*17.3};
  });
  canvas.dataset.active="true";
  const started=performance.now();
  const render=(now:number)=>{
   if(disposed)return;
   if(now-lastFrame<30){raf=requestAnimationFrame(render);return;}
   lastFrame=now;
   const elapsed=now-started,progress=Math.min(1,elapsed/duration);
   ctx.clearRect(0,0,width,height);
   const sweep=(progress*1.24-0.12)*width;
   const glow=ctx.createLinearGradient(sweep-110,0,sweep+110,0);
   glow.addColorStop(0,"rgba(162,89,255,0)");glow.addColorStop(.5,"rgba(162,89,255,.10)");glow.addColorStop(1,"rgba(162,89,255,0)");
   ctx.fillStyle=glow;ctx.fillRect(sweep-110,0,220,height);
   agents.forEach((agent,i)=>{
    const t=Math.max(0,Math.min(1,(progress-agent.delay)/0.78));
    const eased=ease(t),x=agent.sx+(agent.tx-agent.sx)*eased,y=agent.sy+(agent.ty-agent.sy)*eased;
    const wobble=Math.sin(elapsed*.006+agent.seed)*5;
    const px=x+wobble,py=y+Math.cos(elapsed*.005+agent.seed)*4;
    ctx.globalAlpha=(1-progress*.82)*.62;
    ctx.beginPath();ctx.moveTo(agent.sx,agent.sy);ctx.quadraticCurveTo((agent.sx+px)/2,(agent.sy+py)/2-18,px,py);
    ctx.strokeStyle=agent.color;ctx.lineWidth=1.25;ctx.stroke();
    if(t>.52){
     const reveal=Math.min(1,(t-.52)*2.8);
     ctx.globalAlpha=.10*reveal;
     ctx.strokeStyle=agent.color;ctx.lineWidth=1;
     ctx.strokeRect(agent.tx-13,agent.ty-9,34+(i%3)*8,20+(i%4)*5);
    }
    ctx.globalAlpha=1-progress*.75;
    drawCursor(ctx,px,py,agent.color,width<640?.72:.88);
   });
   ctx.globalAlpha=1;
   if(progress<1){raf=requestAnimationFrame(render);}
   else{canvas.dataset.active="false";canvas.style.opacity="0";}
  };
  const onResize=()=>resize();
  window.addEventListener("resize",onResize,{passive:true});
  canvas.style.opacity="1";
  raf=requestAnimationFrame(render);
  return ()=>{
   disposed=true;cancelAnimationFrame(raf);window.removeEventListener("resize",onResize);
   canvas.dataset.active="false";canvas.style.opacity="0";
  };
 },[pathname]);

 return <canvas ref={canvasRef} className="lx-swarm-native-transition" aria-hidden="true"/>;
}
