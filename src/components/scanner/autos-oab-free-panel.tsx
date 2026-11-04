"use client";

import * as React from "react";
import {FileArchive,FileText,Download,ExternalLink,Loader2,Search,ShieldCheck,AlertTriangle,CheckCircle2,FolderOpen} from "lucide-react";
import {Button} from "@/components/ui/button";
import {canonicalCnj} from "@/lib/autos-oab-logic";
import {classifyLocalAutosDocument,findOfficialAutosPortal,normalizeAutasFilename,selectAutosThroughDefesa,type AutosLocalItem} from "@/lib/free-autos-utils";

const MB=1024*1024;
const MAX_ARCHIVE=60*MB;
const MAX_SINGLE=35*MB;
const MAX_TOTAL=150*MB;
const MAX_ENTRIES=250;
const SUPPORTED=/\.pdf$/i;

async function extractFirstPageText(bytes:Uint8Array):Promise<{text:string;pages:number;error?:string}> {
 try{
   // Dynamic import keeps this heavyweight library outside the initial dashboard/scanner bundle.
   const pdfjs=await import("pdfjs-dist");
   const task=pdfjs.getDocument({data:bytes.slice()});
   const doc=await task.promise;
   try{
     const page=await doc.getPage(1);
     const text=await page.getTextContent();
     const lines=text.items.map(item=>("str" in item?String(item.str):""));
     return {text:lines.join(" ").slice(0,4000),pages:doc.numPages};
   } finally { await task.destroy(); }
 }catch{
   return {text:"",pages:0,error:"Este PDF não tem texto extraível na primeira página, está protegido ou exige OCR."};
 }
}
function safeByteSize(n:number):string{
 return n>MB?(n/MB).toFixed(1)+" MB":(n/1024).toFixed(0)+" KB";
}
function downloadBlob(data:Blob,name:string){
 const url=URL.createObjectURL(data);
 const a=document.createElement("a");
 a.href=url;a.download=name;
 document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export function AutosOabFreePanel(){
 const [cnjText,setCnjText]=React.useState("");
 const [expanded,setExpanded]=React.useState(false);
 const [files,setFiles]=React.useState<AutosLocalItem[]>([]);
 const [busy,setBusy]=React.useState(false);
 const [progress,setProgress]=React.useState("");
 const [error,setError]=React.useState("");
 const [notices,setNotices]=React.useState<string[]>([]);
 const [includeAll,setIncludeAll]=React.useState(false);
 const [confirmed,setConfirmed]=React.useState(false);
 const inputRef=React.useRef<HTMLInputElement|null>(null);
 const cnj=canonicalCnj(cnjText);
 const court=cnj?findOfficialAutosPortal(cnj):null;
 const selected=React.useMemo(()=>selectAutosThroughDefesa(files),[files]);
 const output=includeAll?selectAutosThroughDefesa(files.map(f=>({...f,kind:"outro" as const}))).files: selected.files;
 const consolidated=output.some(f=>f.isConsolidated);
 const unsequenced=selected.limitedByMetadata;
 const ready=!!cnj&&!!files.length&&confirmed&&!busy;
 React.useEffect(()=>{
   if(!expanded)return;
   const params=new URLSearchParams(window.location.search);
   const value=params.get("cnj")||params.get("search")||"";
   const found=canonicalCnj(value);
   if(found)setCnjText(found);
 },[expanded]);
 async function importFiles(list:FileList|null) {
   if(!list?.length||busy)return;
   const incoming=[...Array.from(list)];
   setBusy(true);setProgress("Lendo documentos no navegador…");setError("");setConfirmed(false);
   const items:AutosLocalItem[]=[];
   const noticesLocal:string[]=[];
   let loaded=0,total=0;
   try{
     const JSZip=(await import("jszip")).default;
     const sources:{name:string;bytes:Uint8Array;archive?:string}[]=[];
     for(const file of incoming) {
       if(file.size>MAX_ARCHIVE)throw new Error(`O arquivo "${file.name}" excede 60 MB. Divida o download em lotes menores.`);
       if(file.name.toLowerCase().endsWith(".zip")){
         setProgress(`Inspecionando pacote ${file.name}…`);
         const zip=await JSZip.loadAsync(file);
         const all=Object.values(zip.files);
         if(all.length>MAX_ENTRIES)throw new Error("ZIP com mais de 250 entradas. Separe o pacote em lotes.");
         for(const entry of all){
           if(entry.dir||!SUPPORTED.test(entry.name))continue;
           if(sources.length>=MAX_ENTRIES)throw new Error("Mais de 250 PDFs. Divida o pacote em lotes.");
           const bytes=await entry.async("uint8array");
           if(bytes.byteLength>MAX_SINGLE)throw new Error("Documento extraído maior que 35 MB.");
           total+=bytes.byteLength;
           if(total>MAX_TOTAL)throw new Error("Documentos somam mais de 150 MB; processe em lotes.");
           sources.push({name:normalizeAutasFilename(entry.name),bytes,archive:normalizeAutasFilename(file.name)});
         }
       }else if(SUPPORTED.test(file.name)){
         const bytes=new Uint8Array(await file.arrayBuffer());
         if(bytes.byteLength>MAX_SINGLE)throw new Error("Documento maior que 35 MB: "+file.name);
         total+=bytes.byteLength;
         if(total>MAX_TOTAL)throw new Error("Documentos somam mais de 150 MB.");
         sources.push({name:normalizeAutasFilename(file.name),bytes});
       }else noticesLocal.push("Arquivo ignorado (não é PDF ou ZIP): "+normalizeAutasFilename(file.name));
     }
     if(!sources.length)throw new Error("Não foram encontrados PDFs. Exporte os autos do tribunal em PDF ou ZIP.");
     for(const file of sources){
       loaded++;
       setProgress(`Lendo PDF ${loaded}/${sources.length}: ${file.name}`);
       const {text,pages,error:pdfError}=await extractFirstPageText(file.bytes);
       if(pdfError)noticesLocal.push(file.name+": "+pdfError);
       const found=classifyLocalAutosDocument(file.name,text);
       items.push({
         id:`${loaded}-${file.archive||"arquivo"}-${file.name}`,
         filename:file.name,bytes:file.bytes,kind:found.kind,
         isConsolidated:found.isConsolidated || (pages>=30 && /autos|processo completo/i.test(file.name)),
         bankNamed:found.bankNamed,preview:text.slice(0,900),pages,
         sourceArchive:file.archive,
       });
     }
     setFiles(items);
     setNotices(noticesLocal);
     setProgress(`${items.length} PDF(s) analisados no dispositivo. Não houve upload ao servidor.`);
   }catch(e){
     setFiles([]);
     setError(e instanceof Error?e.message:"Falha ao ler documentos no navegador.");
     setNotices(noticesLocal);
     setProgress("");
   }finally{
     setBusy(false);
     if(inputRef.current)inputRef.current.value="";
   }
 }
 async function saveZip(){
   if(!ready||!cnj)return;
   setBusy(true);setError("");setProgress("Preparando pacote local…");
   try{
     const JSZip=(await import("jszip")).default;
     const zip=new JSZip();
     const path="pecas/";
     const seen=new Set<string>();
     for(let i=0;i<output.length;i++){
       const item=output[i];
       const safe=normalizeAutasFilename(item.filename);
       let name=`${String(i+1).padStart(3,"0")}-${safe}`;
       while(seen.has(name))name=`${String(i+1).padStart(3,"0")}-${seen.size}-${safe}`;
       seen.add(name);
       zip.file(path+name,item.bytes);
     }
     const manifest={
       cnj,origem:"Arquivos exportados manualmente do portal judicial e lidos apenas no navegador",
       geradoEm:new Date().toISOString(),
       arquivosRecebidos:files.length,arquivosNestePacote:output.length,
       primeiraContestacaoIdentificada:selected.foundContestacao,
       autoriaDaContestacaoPeloBancoConfirmada:false,
       ordemDaListaInferidaPorNomes:unsequenced,
       documentosConsolidadosNaoRecortados:consolidated,
       arquivos:output.map((x,i)=>({
         ordem:i+1,nome:x.filename,tipo:x.kind,fonteZip:x.sourceArchive||null,
         paginas:x.pages||null,tamanho:x.bytes.byteLength,
       })),
       limites:"A identificação por nome e primeira página não é certificação da existência ou autoria da contestação; leia e confira os documentos e os autos oficiais.",
     };
     zip.file("manifesto.json",JSON.stringify(manifest,null,2));
     zip.file("LEIA-ME.txt",[
       "LexisPredict - Autos exportados do tribunal - modo gratuito",
       "Processo: "+cnj,
       "Fonte: arquivos fornecidos pelo operador após acesso autorizado ao portal oficial.",
       "Consulta automática ao PJe: NÃO realizada pelo LexisPredict.",
       "Primeira possível contestação: "+(selected.foundContestacao?"detectada por título/texto inicial":"não identificada"),
       "Banco como autor da contestação: NÃO confirmado.",
       "PDF consolidado: "+(consolidated?"SIM - não foi feito corte interno de páginas":"NÃO identificado"),
       "Ordem com metadados incompletos: "+(unsequenced?"SIM":"NÃO"),
       "Não utilizar como prova de juntada ou certidão judicial sem verificar o portal.",
     ].join("\n"));
     const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:3}});
     downloadBlob(blob,`autos-${cnj.replace(/\D/g,"")}-${includeAll?"integral":"ate-contestacao"}.zip`);
     setProgress(`Pacote com ${output.length} documento(s) salvo localmente.`);
   }catch(e){setError(e instanceof Error?e.message:"Falha ao criar ZIP.");}
   finally{setBusy(false);}
 }
 return (
  <section className="rounded-xl border border-primary/50 bg-card p-4 space-y-3 text-card-foreground">
    <button type="button" className="w-full flex items-start gap-3 text-left" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
      <ShieldCheck size={19} className="shrink-0 mt-0.5 text-primary"/>
      <span className="flex-1 space-y-1">
        <strong className="block text-sm">Autos judiciais · modo gratuito</strong>
        <span className="block text-[11px] text-muted-foreground">Use o PJe com o certificado do advogado e organize os PDFs até a possível contestação, sem API ou assinatura paga.</span>
      </span>
      <span className="text-xs text-primary font-bold">{expanded?"Fechar":"Abrir"}</span>
    </button>
    {expanded&&<div className="space-y-3">
      <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs space-y-2">
        <p className="font-semibold">1. Abra o tribunal e autentique-se normalmente</p>
        <p>O certificado A1 ou A3 permanece no computador do advogado, usando o PJeOffice Pro ou o gerenciador exigido pelo tribunal. Faça a consulta pelo CNJ e use a função oficial de baixar autos/documentos.</p>
        <a href="https://docs.pje.jus.br/servicos-negociais/pjeoffice-pro/" rel="noopener noreferrer" target="_blank" className="text-primary underline inline-flex gap-1 items-center">
          Instruções oficiais do PJeOffice Pro <ExternalLink size={12}/>
        </a>
      </div>
      <label htmlFor="autos-free-cnj" className="block text-xs font-semibold space-y-1">
        Número CNJ
        <input id="autos-free-cnj" autoComplete="off" placeholder="0000000-00.0000.0.00.0000"
          value={cnjText} onChange={e=>{setCnjText(e.target.value);setFiles([]);setConfirmed(false);setProgress("");setError("");}}
          className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"/>
      </label>
      {cnj && <div className="flex flex-wrap gap-2 items-center">
        {court?<a href={court.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
          <ExternalLink size={13}/> Abrir {court.tribunal} · {court.sistema.toUpperCase()}
        </a>:<p className="text-xs text-muted-foreground">Tribunal não mapeado para abertura automática. Acesse o portal oficial de sua Justiça.</p>}
        <span className="text-[10px] text-muted-foreground">Pesquise pelo CNJ no portal. O certificado não é lido pelo LexisPredict.</span>
      </div>}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <p className="font-semibold text-xs">2. Importe o que o tribunal disponibilizou</p>
        <p className="text-xs text-muted-foreground">Selecione PDFs individuais ou ZIP exportado no PJe. Eles são lidos apenas nesta aba e não enviados ao Supabase, à Vercel nem a APIs de terceiros.</p>
        <input ref={inputRef} type="file" multiple accept=".pdf,.zip,application/pdf,application/zip"
          aria-label="Selecionar PDFs ou ZIP dos autos" onChange={e=>void importFiles(e.currentTarget.files)}
          className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-primary-foreground"/>
        <p className="text-[10px] text-muted-foreground">Até 60 MB por arquivo de entrada; 150 MB por operação, 250 PDFs no máximo. PDFs com senha ou digitalizados sem texto podem exigir conferência manual.</p>
      </div>
      {busy&&<div role="status" className="flex gap-2 items-center text-xs text-primary"><Loader2 size={15} className="animate-spin"/>{progress||"Processando…"}</div>}
      {!busy&&progress&&<p role="status" className="text-xs text-muted-foreground">{progress}</p>}
      {error&&<p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-foreground">{error}</p>}
      {files.length>0&&<div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold">{files.length} PDFs · {selected.files.length} no recorte automático</p>
          {selected.foundContestacao?<span className="inline-flex items-center gap-1 text-xs text-primary"><CheckCircle2 size={14}/> Possível contestação</span>:
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle size={14}/> Contestação não identificada</span>}
        </div>
        <p className="text-[11px] text-muted-foreground">
          A ordem é inferida pelos números nos nomes dos arquivos. Uma possível contestação é identificada pelo título ou cabeçalho; não há confirmação de que o banco a tenha apresentado.
          {consolidated?" Arquivos integrais/consolidados não serão cortados por página.":""}
        </p>
        {notices.length>0&&<details className="text-[11px] text-muted-foreground"><summary className="cursor-pointer">{notices.length} aviso(s) de leitura</summary><div className="space-y-1 mt-2">{notices.slice(0,10).map((t,i)=><p key={i}>{t}</p>)}</div></details>}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={includeAll} onChange={e=>setIncludeAll(e.target.checked)} className="accent-primary"/> Incluir peças posteriores à contestação (autos integrais)</label>
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {output.map((f,i)=><div key={f.id} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2 text-[11px]">
            <FileText size={13} className="text-primary shrink-0"/>
            <span className="flex-1 min-w-0 break-all">{String(i+1).padStart(3,"0")} · {f.filename}</span>
            {f.kind==="contestacao"&&<span className="text-primary font-semibold shrink-0">Contestação?</span>}
            <span className="text-muted-foreground shrink-0">{safeByteSize(f.bytes.byteLength)}</span>
          </div>)}
        </div>
        <label className="flex gap-2 items-start text-xs">
          <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 accent-primary"/>
          Confirmo que os documentos pertencem ao CNJ informado e tenho autorização para tratá-los.
        </label>
        <Button type="button" className="w-full" disabled={!ready} onClick={()=>void saveZip()}>
          <Download size={14} className="mr-2"/> Baixar pacote {includeAll?"integral":"até possível contestação"} · grátis
        </Button>
        <p className="text-[10px] text-muted-foreground">Nenhuma consulta autenticada é executada pela nuvem. O acesso aos autos ocorre somente no portal judicial aberto e autenticado pelo próprio advogado; esta ferramenta processa os arquivos depois do download.</p>
      </div>}
    </div>}
  </section>
 );
}
