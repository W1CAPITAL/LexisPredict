'use client';
import React,{useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import {JURISPANEL_TIPOS,JURISPANEL_TIPOS_LISTA,criarEstruturaAutoral,preencherModeloAutor} from '@/lib/jurispanel-templates';
import {listJurisTemplatesAction,saveJurisTemplateAction,deleteJurisTemplateAction,findJurisProcessAction,type JurisTemplate} from '@/app/actions/jurispanel-actions';
import {gerarPecaTextoPDFAction} from '@/app/actions/document-actions';
import {downloadBase64File} from '@/lib/download-export';
type Shared=JurisTemplate&{editavel?:boolean};
const initial=criarEstruturaAutoral('Petição Inicial');
const slug=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,70)||'minuta';
const xml=(s:string)=>s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]||c));
function download(name:string,blob:Blob){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export default function JurisModelos(){
 const [rows,setRows]=useState<Shared[]>([]);
 const [id,setId]=useState(''),[editavel,setEditavel]=useState(true);
 const [titulo,setTitulo]=useState('Petição Inicial'),[categoria,setCategoria]=useState('Cível'),[corpo,setCorpo]=useState(initial);
 const [cnj,setCnj]=useState(''),[cliente,setCliente]=useState(''),[fatos,setFatos]=useState(''),[fundamentos,setFundamentos]=useState(''),[pedidos,setPedidos]=useState(''),[provas,setProvas]=useState('');
 const [rascunho,setRascunho]=useState<string|null>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const load=useCallback(async()=>{const r=await listJurisTemplatesAction();if(r.success)setRows(r.rows as Shared[]);else setMsg(r.error||'Falha na leitura');},[]);
 useEffect(()=>{void load();},[load]);
 const generated=preencherModeloAutor(corpo,{cnj,cliente,fatos,fundamentos,pedidos,provas});
 const texto=rascunho===null?generated:rascunho;
 const choose=(type:string)=>{
  const found=JURISPANEL_TIPOS_LISTA.find(x=>x.titulo===type);
  if(!found)return;
  setId('');setTitulo(type);setCategoria(found.categoria);setCorpo(criarEstruturaAutoral(type));
  setEditavel(true);setRascunho(null);setMsg('Estrutura básica carregada para revisão.');
 };
 const select=(row:Shared)=>{
  setId(row.id);setTitulo(row.titulo);setCategoria(row.categoria);setCorpo(row.corpo);
  setEditavel(row.editavel!==false);setRascunho(null);
  setMsg(row.editavel===false?'Modelo de outra pessoa: duplique para alterar.':'Modelo aberto.');
 };
 const save=async()=>{
  setBusy(true);const r=await saveJurisTemplateAction({id:id||undefined,titulo,categoria,corpo});setBusy(false);
  if(!r.success){setMsg(r.error||'Falha ao salvar');return;}
  setId(r.id);setMsg('Modelo salvo no Supabase.');void load();
 };
 const remove=async()=>{
  if(!id||!window.confirm('Excluir modelo?'))return;
  const r=await deleteJurisTemplateAction(id);
  if(!r.success){setMsg(r.error||'Sem permissão');return;}
  setId('');setCorpo(initial);setTitulo('Petição Inicial');setEditavel(true);setMsg('Modelo excluído.');void load();
 };
 const search=async()=>{
  setBusy(true);const r=await findJurisProcessAction(cnj);setBusy(false);
  if(r.success){setCnj(r.cnj);setCliente(r.cliente);setMsg('Processo localizado na empresa.');}
  else setMsg(r.error||'Processo não encontrado');
 };
 const pdf=async()=>{
  setBusy(true);const r=await gerarPecaTextoPDFAction({texto,titulo,sub:'Minuta não homologada • revisar integralmente'});setBusy(false);
  if('base64' in r&&r.base64)downloadBase64File(r.base64,slug(titulo)+'.pdf','application/pdf');
  else setMsg('Falha ao gerar PDF.');
 };
 const docx=async()=>{
  setBusy(true);
  try{
   const JSZip=(await import('jszip')).default,zip=new JSZip();
   const paragraphs=texto.split(/\r?\n/).map(s=>'<w:p><w:r><w:t xml:space="preserve">'+xml(s)+'</w:t></w:r></w:p>').join('');
   zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
   zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
   zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr/></w:body></w:document>');
   download(slug(titulo)+'.docx',await zip.generateAsync({type:'blob'}));
  }catch{setMsg('Erro ao exportar DOCX.');}setBusy(false);
 };
 return <div className="flex min-h-screen bg-background text-foreground"><Sidebar/>
  <main className="min-w-0 flex-1 space-y-5 p-4 lg:p-8">
   <header><Link href="/jurispanel" className="text-sm text-primary underline">Central jurídica</Link><h1 className="mt-2 text-3xl font-extrabold">Modelos autorais e 46 tipos de minutas</h1>
   <p className="mt-2 text-sm text-muted-foreground">Estruturas editáveis, não 46 peças validadas para protocolo. O proprietário edita o modelo, colegas podem utilizá-lo.</p></header>
   <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
    <aside className="space-y-4">
     <div className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-semibold">Biblioteca da empresa</h2>
      <button className="mb-3 w-full rounded-lg bg-primary p-3 text-sm font-bold text-primary-foreground" onClick={()=>{setId('');setEditavel(true);setTitulo('Novo modelo');setCategoria('Petição');setCorpo('MINUTA\nProcesso: {{CNJ}}\nCliente: {{CLIENTE}}\n\nFATOS\n{{FATOS}}\n\nFUNDAMENTOS\n{{FUNDAMENTOS}}\n\nPEDIDOS\n{{PEDIDOS}}');setRascunho(null);}}>Novo modelo</button>
      <div className="max-h-[400px] space-y-2 overflow-y-auto">{rows.map(row=><button key={row.id} onClick={()=>select(row)} className="block w-full rounded-lg border p-3 text-left text-sm hover:border-primary">
       <span className="block font-semibold">{row.titulo}</span><span className="text-xs text-muted-foreground">{row.categoria} • {row.editavel===false?'Compartilhado':'Editável'}</span></button>)}
       {rows.length===0?<p className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>:null}</div>
     </div>
     <div className="rounded-xl border bg-card p-4"><h2 className="mb-2 font-semibold">46 tipos disponíveis</h2>
      <select defaultValue="" onChange={e=>choose(e.target.value)} className="w-full rounded-lg border bg-background p-3 text-sm">
       <option value="">Selecione a estrutura...</option>
       {Object.entries(JURISPANEL_TIPOS).map(([key,values])=><optgroup key={key} label={key}>{(values as readonly string[]).map(x=><option key={x} value={x}>{x}</option>)}</optgroup>)}
      </select><p className="mt-3 text-xs text-muted-foreground">As estruturas exigem análise de competência, prazos, provas e jurisprudência.</p>
      <Link href="/documents/generator" className="mt-3 block text-sm text-primary underline">Abrir gerador jurídico completo</Link>
     </div>
    </aside>
    <div className="space-y-4">
     <section className="rounded-xl border bg-card p-5"><h2 className="mb-3 font-bold">Texto do modelo</h2>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Título<input value={titulo} disabled={!editavel} maxLength={160} onChange={e=>setTitulo(e.target.value)} className="mt-1 w-full rounded border bg-background p-3"/></label>
       <label className="text-sm">Categoria<input value={categoria} disabled={!editavel} maxLength={80} onChange={e=>setCategoria(e.target.value)} className="mt-1 w-full rounded border bg-background p-3"/></label></div>
      <textarea rows={12} maxLength={30000} disabled={!editavel} value={corpo} onChange={e=>{setCorpo(e.target.value);setRascunho(null);}} className="mt-3 w-full rounded border bg-background p-3 font-mono text-sm"/>
      <p className="text-xs text-muted-foreground">Variáveis disponíveis: {'{{CNJ}}'}, {'{{CLIENTE}}'}, {'{{FATOS}}'}, {'{{FUNDAMENTOS}}'}, {'{{PROVAS}}'}, {'{{PEDIDOS}}'}.</p>
      <div className="mt-3 flex flex-wrap gap-2">{editavel?<button disabled={busy} onClick={()=>void save()} className="rounded bg-primary px-4 py-2 text-primary-foreground">Salvar no Supabase</button>:null}
       <button className="rounded border px-4 py-2" onClick={()=>{setId('');setEditavel(true);setTitulo(titulo+' - cópia');}}>Duplicar</button>
       {id&&editavel?<button className="rounded border px-4 py-2 text-red-600" onClick={()=>void remove()}>Excluir</button>:null}</div>
     </section>
     <section className="rounded-xl border bg-card p-5"><h2 className="mb-3 font-bold">Preencher dados e fatos</h2>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">CNJ<input value={cnj} onChange={e=>setCnj(e.target.value)} className="mt-1 w-full rounded border bg-background p-3"/></label>
       <div className="flex items-end"><button disabled={busy||!cnj} className="w-full rounded border p-3" onClick={()=>void search()}>Localizar cliente na carteira</button></div>
       <label className="text-sm sm:col-span-2">Cliente<input value={cliente} onChange={e=>setCliente(e.target.value)} className="mt-1 w-full rounded border bg-background p-3"/></label>
       {([['Fatos',fatos,setFatos],['Fundamentos',fundamentos,setFundamentos],['Provas',provas,setProvas],['Pedidos',pedidos,setPedidos]] as const).map(([label,value,setter])=><label key={label} className="text-sm">
        {label}<textarea rows={4} value={value} onChange={e=>setter(e.target.value)} className="mt-1 w-full rounded border bg-background p-3"/></label>)}
      </div>
     </section>
     <section className="rounded-xl border bg-card p-5"><h2 className="mb-3 font-bold">Rascunho final editável</h2>
      <textarea rows={20} aria-label="Minuta gerada" value={texto} onChange={e=>setRascunho(e.target.value)} className="w-full rounded border bg-background p-4 font-serif leading-7"/>
      <p className="mt-2 text-xs text-amber-600">A minuta não foi validada judicialmente. Revisão humana integral obrigatória antes de protocolo.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={()=>void pdf()}>Exportar PDF</button>
       <button disabled={busy} className="rounded border px-4 py-2" onClick={()=>void docx()}>Exportar DOCX</button>
       <button className="rounded border px-4 py-2" onClick={()=>download(slug(titulo)+'.txt',new Blob([texto],{type:'text/plain;charset=utf-8'}))}>Exportar TXT</button>
       <button className="rounded border px-4 py-2" onClick={()=>void navigator.clipboard.writeText(texto).then(()=>setMsg('Copiado')).catch(()=>setMsg('Não foi possível copiar'))}>Copiar</button></div>
     </section>
     {msg?<p role="status" className="rounded border bg-card p-3 text-sm">{msg}</p>:null}
    </div>
   </div>
  </main>
 </div>;
}
