"use client";

import * as React from "react";
import {extractCnjFromPastedPortalResults} from "@/lib/oab-discovery";

/**
 * Importação assistida local, baseada na estratégia do MAAT Monitor (MIT).
 * Não lê certificado, sessão do tribunal, cookies ou dados da página.
 */
export function OabDiscoveryPanel(){
 const [text,setText]=React.useState("");
 const [copyStatus,setCopyStatus]=React.useState("");
 const result=React.useMemo(()=>extractCnjFromPastedPortalResults(text),[text]);
 const output=result.numbers.join("\n");

 async function copy(){
  if(!output)return;
  try{
   await navigator.clipboard.writeText(output);
   setCopyStatus("Números copiados. Confira e importe somente os processos autorizados.");
  }catch{
   setCopyStatus("A cópia automática foi bloqueada. Selecione a lista e copie manualmente.");
  }
 }
 function download(){
  if(!output)return;
  const blob=new Blob([output+"\n"],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="lexispredict-processos-cnj-validados.txt";
  document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 return <section id="descoberta-oab" className="rounded-xl border border-border bg-muted/20 p-3 space-y-4" aria-labelledby="descoberta-oab-titulo">
  <div className="space-y-2">
   <h2 id="descoberta-oab-titulo" className="text-lg font-bold">Descobrir processos pela OAB — importação assistida</h2>
   <p className="text-sm text-muted-foreground">Abra o portal oficial, faça a consulta por OAB ou advogado e copie a lista de processos. Cole o resultado abaixo: o LexisPredict extrai apenas números CNJ com dígito verificador válido. Sem extensão ou acesso ao seu certificado.</p>
  </div>
  <div className="flex flex-wrap gap-2 text-sm">
   <a href="https://esaj.tjsp.jus.br/cpopg/open.do" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-primary hover:bg-muted">TJSP · e-SAJ</a>
   <a href="https://eproc.trf2.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica_oab" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-primary hover:bg-muted">TRF2 · consulta OAB</a>
   <a href="https://pje.trt1.jus.br/consultaprocessual/" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-primary hover:bg-muted">TRT1 · consulta pública</a>
   <a href="https://www.cnj.jus.br/poder-judiciario/tribunais/" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-primary hover:bg-muted">Outros tribunais</a>
  </div>
  <label htmlFor="oab-portal-colado" className="block text-sm font-semibold">Texto copiado dos resultados do tribunal</label>
  <textarea id="oab-portal-colado" className="min-h-36 w-full rounded-xl border border-input bg-background p-3 font-mono text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Cole a lista de resultados aqui; nenhum dado será enviado ao servidor." value={text} maxLength={150000} onChange={e=>{setText(e.target.value);setCopyStatus("");}}/>
  <p className="text-xs text-muted-foreground" role="status">{result.numbers.length} número(s) válido(s) · {result.duplicates} repetido(s) · {result.invalid} inválido(s){result.truncated?" · lista parcial (limite atingido)":""}.</p>
  {result.numbers.length>0&&<>
   <label htmlFor="oab-cnj-output" className="block text-sm font-semibold">Números CNJ validados — confira antes de importar</label>
   <textarea id="oab-cnj-output" readOnly value={output} rows={Math.min(10,Math.max(3,result.numbers.length))} className="w-full rounded-xl border border-input bg-muted/30 p-3 font-mono text-xs text-foreground"/>
   <div className="flex flex-wrap gap-2">
    <button type="button" onClick={copy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Copiar lista</button>
    <button type="button" onClick={download} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Baixar .txt</button>
   </div>
  </>}
  {copyStatus&&<p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>}
  <p className="text-xs leading-5 text-muted-foreground">Esta ferramenta não faz descoberta automática, não acessa autos sigilosos, não resolve CAPTCHA e não confirma vínculo de representação: apenas valida os números encontrados no texto fornecido pelo operador.</p>
 </section>;
}
