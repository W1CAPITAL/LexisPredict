"use client";

import React,{useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {Sidebar} from "@/components/layout/sidebar";
import {useAuth} from "@/components/auth/auth-provider";
import {listAssignableUsersAction,type AssignableUser} from "@/app/actions/team-list-actions";
import {
 listOpsWorkflowsAction,createOpsWorkflowAction,updateOpsWorkflowAction,
 listOpsInboxAction,saveOpsInboxAction,listOpsAgentsAction,createOpsAgentDraftAction,
 testOpsAgentAction,publishOpsAgentAction,runOpsAgentAction,
 listOpsGrantsAction,setOpsGrantAction
} from "@/app/actions/ops-suite-actions";
import {
 createOpsIntakeFormAction,listOpsIntakeFormsAction,revokeOpsIntakeFormAction,
 listOpsIntakeSubmissionsAction,reviewOpsIntakeSubmissionAction,
 listOpsCallsAction,createOpsCallAction,listOpsIntegrationsAction,checkOpsIntegrationAction
} from "@/app/actions/ops-suite-more-actions";
import {
 listOpsInboxNotesAction,listOpsAuditAction,getOpsAttachmentLinkAction,getOpsCallTranscriptAction
} from "@/app/actions/ops-suite-extras-actions";
import {OPS_CAPABILITIES,type OpsCapability,type IntakeField} from "@/lib/ops-suite/policy";

type Tab="workflow"|"inbox"|"agents"|"intake"|"permissions"|"calls"|"integrations";
const tabs:{id:Tab;label:string;detail:string}[]=[
 {id:"workflow",label:"Fluxos jurídicos",detail:"Etapas colaborativas da carteira"},
 {id:"inbox",label:"Atendimento",detail:"Fila e transferência de WhatsApp"},
 {id:"agents",label:"Agentes",detail:"Versões, testes e execução revisável"},
 {id:"intake",label:"Formulários",detail:"Recebimento de dados e anexos"},
 {id:"permissions",label:"Permissões",detail:"Controles por usuário e auditoria"},
 {id:"calls",label:"Ligações",detail:"Registro manual e transcrições consentidas"},
 {id:"integrations",label:"Integrações",detail:"Estado observado das conexões"}
];
const input="h-10 min-w-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground";
const area="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground";
const btn="rounded-lg bg-[#69243c] px-4 py-2 text-xs font-bold text-white disabled:opacity-50";
const ghost="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50";
const card="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-3";
const field="block space-y-1 text-xs font-semibold text-foreground";
const integrations=["datajud","djen","whatsapp_local","google_calendar","ia"] as const;
const defaultFields:IntakeField[]=[
 {key:"nome",label:"Nome completo",type:"text",required:true},
 {key:"email",label:"E-mail",type:"email",required:false},
 {key:"telefone",label:"Telefone",type:"phone",required:true},
 {key:"descricao",label:"Descrição do pedido",type:"textarea",required:true}
];

export default function OperacoesIntegradasPage(){
 const {profile}=useAuth();
 const selfId=String((profile as any)?.auth_user_id||"");
 const [tab,setTab]=useState<Tab>("workflow");
 const [rows,setRows]=useState<any[]>([]);
 const [users,setUsers]=useState<AssignableUser[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [preview,setPreview]=useState("");
 const [cnj,setCnj]=useState("");
 const [stepKey,setStepKey]=useState("conferir-publicacao");
 const [stepTitle,setStepTitle]=useState("Conferir publicação oficial");
 const [stepDescription,setStepDescription]=useState("");
 const [assigned,setAssigned]=useState("");
 const [priority,setPriority]=useState("normal");
 const [phone,setPhone]=useState("");
 const [contact,setContact]=useState("");
 const [inboxState,setInboxState]=useState<"nao_atribuido"|"em_atendimento"|"aguardando"|"encerrado">("nao_atribuido");
 const [note,setNote]=useState("");
 const [agentName,setAgentName]=useState("");
 const [slug,setSlug]=useState("");
 const [instructions,setInstructions]=useState("");
 const [agentTools,setAgentTools]=useState<string[]>(["read_case","suggest_tasks"]);
 const [agentMax,setAgentMax]=useState(3);
 const [aiUse,setAiUse]=useState(false);
 const [formName,setFormName]=useState("Solicitação de documentos");
 const [formFields,setFormFields]=useState<IntakeField[]>(defaultFields);
 const [newFieldKey,setNewFieldKey]=useState("");
 const [newFieldLabel,setNewFieldLabel]=useState("");
 const [newFieldType,setNewFieldType]=useState<IntakeField["type"]>("text");
 const [createdLink,setCreatedLink]=useState("");
 const [submissions,setSubmissions]=useState<any[]>([]);
 const [grantUser,setGrantUser]=useState("");
 const [grantCap,setGrantCap]=useState<OpsCapability>("workflow.write");
 const [grantAllowed,setGrantAllowed]=useState(true);
 const [auditRows,setAuditRows]=useState<any[]>([]);
 const [callDirection,setCallDirection]=useState<"entrada"|"saida">("saida");
 const [callStatus,setCallStatus]=useState<"realizada"|"nao_atendida"|"falhou">("realizada");
 const [callNotes,setCallNotes]=useState("");
 const [transcript,setTranscript]=useState("");
 const [consented,setConsented]=useState(false);
 const [provider,setProvider]=useState<typeof integrations[number]>("datajud");
 useEffect(()=>{void listAssignableUsersAction().then(setUsers).catch(()=>{});},[]);
 const load=useCallback(async(selected:Tab)=>{
  setError("");setBusy(true);
  try{
   const result=await (selected==="workflow"?listOpsWorkflowsAction():
    selected==="inbox"?listOpsInboxAction():
    selected==="agents"?listOpsAgentsAction():
    selected==="intake"?listOpsIntakeFormsAction():
    selected==="permissions"?listOpsGrantsAction():
    selected==="calls"?listOpsCallsAction():listOpsIntegrationsAction());
   setRows(result as any[]);
  }catch(e:any){setRows([]);setError(e?.message||"Não foi possível consultar a área.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load(tab);},[tab,load]);
 async function mutate(run:()=>Promise<any>,success="Alteração registrada."){
  setError("");setNotice("");setBusy(true);
  try{const result=await run();setNotice(success);await load(tab);return result;}
  catch(e:any){setError(e?.message||"Falha na operação.");return null;}
  finally{setBusy(false);}
 }
 const userLabel=(authId:string)=>users.find(u=>u.auth_user_id===authId)?.nome||authId.slice(0,8);
 const closeBtn=(label:string,action:()=>Promise<any>)=>
  <button className={ghost} disabled={busy} onClick={()=>void mutate(action)}>{label}</button>;
 const renderWorkflows=()=><div className="space-y-5">
  <section className={card}>
   <h2 className="font-bold">Nova etapa do processo</h2>
   <p className="text-xs text-muted-foreground">Evita duplicidade por CNJ e identificador da etapa. Não cria prazo judicial automaticamente.</p>
   <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    <label className={field}>Número CNJ<input className={input} value={cnj} onChange={e=>setCnj(e.target.value)} placeholder="0000000-00.2026.8.26.0001"/></label>
    <label className={field}>Identificador da etapa<input className={input} value={stepKey} onChange={e=>setStepKey(e.target.value)}/></label>
    <label className={field}>Título<input className={input} value={stepTitle} onChange={e=>setStepTitle(e.target.value)}/></label>
    <label className={field}>Prioridade<select className={input} value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">Normal</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label>
    <label className={field}>Responsável<select className={input} value={assigned} onChange={e=>setAssigned(e.target.value)}><option value="">Não atribuído</option>{users.map(u=><option key={u.auth_user_id} value={u.auth_user_id}>{u.nome}</option>)}</select></label>
   </div>
   <label className={field}>Instruções operacionais<textarea className={area} value={stepDescription} onChange={e=>setStepDescription(e.target.value)}/></label>
   <div><button className={btn} disabled={busy} onClick={()=>void mutate(()=>createOpsWorkflowAction({cnj,stepKey,title:stepTitle,description:stepDescription,priority,assignedAuthId:assigned||undefined}),"Etapa salva na carteira da empresa.")}>Criar etapa</button></div>
  </section>
  <div className="grid gap-3">
   {rows.map(r=><article className={card} key={r.id}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{r.title}</h3><span className="text-xs font-semibold">{r.priority} · {r.status}</span></div>
    <p className="text-xs text-muted-foreground">{r.cnj} · responsável: {r.assigned_auth_id?userLabel(r.assigned_auth_id):"não atribuído"}</p>
    {r.description?<p className="text-sm">{r.description}</p>:null}
    <div className="flex flex-wrap gap-2">
     {r.status!=="em_andamento"&&closeBtn("Em andamento",()=>updateOpsWorkflowAction({id:r.id,status:"em_andamento"}))}
     {r.status!=="concluido"&&closeBtn("Concluir",()=>updateOpsWorkflowAction({id:r.id,status:"concluido"}))}
     {r.status!=="pendente"&&closeBtn("Reabrir",()=>updateOpsWorkflowAction({id:r.id,status:"pendente"}))}
    </div>
   </article>)}
  </div>
 </div>;
 const renderInbox=()=><div className="space-y-5">
  <section className={card}>
   <h2 className="font-bold">Organizar atendimento compartilhado</h2>
   <p className="text-xs text-muted-foreground">Atribuições e notas internas. O envio de mensagens continua no terminal WhatsApp já existente.</p>
   <div className="grid gap-3 md:grid-cols-2">
    <label className={field}>Telefone com DDD<input className={input} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <label className={field}>Nome do contato<input className={input} value={contact} onChange={e=>setContact(e.target.value)}/></label>
    <label className={field}>CNJ vinculado (opcional)<input className={input} value={cnj} onChange={e=>setCnj(e.target.value)}/></label>
    <label className={field}>Fila<select className={input} value={inboxState} onChange={e=>setInboxState(e.target.value as typeof inboxState)}>
     <option value="nao_atribuido">Não atribuído</option><option value="em_atendimento">Em atendimento</option>
     <option value="aguardando">Aguardando resposta</option><option value="encerrado">Encerrado</option>
    </select></label>
    <label className={field}>Responsável<select className={input} value={assigned} onChange={e=>setAssigned(e.target.value)}>
     <option value="">Não atribuído</option>{users.map(u=><option key={u.auth_user_id} value={u.auth_user_id}>{u.nome}</option>)}
    </select></label>
   </div>
   <label className={field}>Nota interna (não enviada)<textarea className={area} value={note} onChange={e=>setNote(e.target.value)} maxLength={1800}/></label>
   <div className="flex flex-wrap gap-2">
    <button className={btn} disabled={busy} onClick={()=>void mutate(()=>saveOpsInboxAction({phone,cnj:cnj||undefined,displayName:contact,state:inboxState,assignedAuthId:assigned||null,note}),"Fila do contato atualizada.")}>Registrar ou transferir</button>
    <Link href="/whatsapp" className={ghost}>Abrir WhatsApp</Link>
   </div>
  </section>
  {rows.map(r=><article className={card} key={r.id}>
   <div className="flex flex-wrap justify-between gap-2"><strong>{r.display_name||r.phone}</strong><span className="text-xs">{r.state}</span></div>
   <p className="text-xs text-muted-foreground">{r.phone} · {r.cnj||"sem CNJ"} · {r.assigned_auth_id?userLabel(r.assigned_auth_id):"não atribuído"}</p>
   <div className="flex flex-wrap gap-2">
    {closeBtn("Assumir atendimento",()=>saveOpsInboxAction({phone:r.phone,cnj:r.cnj||undefined,displayName:r.display_name,state:"em_atendimento",assignedAuthId:selfId||null}))}
    {closeBtn("Aguardar",()=>saveOpsInboxAction({phone:r.phone,cnj:r.cnj||undefined,displayName:r.display_name,state:"aguardando",assignedAuthId:r.assigned_auth_id}))}
    {closeBtn("Encerrar",()=>saveOpsInboxAction({phone:r.phone,cnj:r.cnj||undefined,displayName:r.display_name,state:"encerrado",assignedAuthId:r.assigned_auth_id}))}
    <button className={ghost} onClick={()=>void listOpsInboxNotesAction(r.id).then(data=>setPreview(data.map((x:any)=>x.created_at+" · "+x.event+": "+(x.details?.note||"")).join("\n"))).catch(e=>setError(e.message))}>Notas internas</button>
   </div>
  </article>)}
 </div>;
 const renderAgents=()=><div className="space-y-5">
  <section className={card}>
   <h2 className="font-bold">Criar versão de agente</h2>
   <p className="text-xs text-muted-foreground">Ações permitidas somente de leitura e rascunho. Teste a versão antes de publicar.</p>
   <div className="grid gap-3 md:grid-cols-2">
    <label className={field}>Nome<input className={input} value={agentName} onChange={e=>setAgentName(e.target.value)}/></label>
    <label className={field}>Código do agente (estável entre versões)<input className={input} value={slug} onChange={e=>setSlug(e.target.value)} placeholder="revisor-de-publicacoes"/></label>
    <label className={field}>Limite de chamadas por execução<input className={input} type="number" min={1} max={25} value={agentMax} onChange={e=>setAgentMax(Number(e.target.value))}/></label>
   </div>
   <label className={field}>Instruções<textarea className={area} value={instructions} onChange={e=>setInstructions(e.target.value)} maxLength={6000}/></label>
   <div className="flex flex-wrap gap-3 text-xs">{[
    ["read_case","Ler processo"],["suggest_tasks","Sugerir etapas"],["draft_message","Rascunho"],["lookup_official","Indicar fonte oficial"]
   ].map(([key,label])=><label key={key} className="flex items-center gap-2">
    <input type="checkbox" checked={agentTools.includes(key)} onChange={e=>setAgentTools(old=>e.target.checked?[...old,key]:old.filter(x=>x!==key))}/>{label}
   </label>)}</div>
   <button className={btn} disabled={busy} onClick={()=>void mutate(()=>createOpsAgentDraftAction({slug,name:agentName,instructions,tools:agentTools,maxCalls:agentMax,humanReview:true}),"Nova versão de agente salva como rascunho.")}>Salvar nova versão</button>
  </section>
  <section className={card}>
   <label className={field}>CNJ para teste ou execução<input className={input} value={cnj} onChange={e=>setCnj(e.target.value)} placeholder="Processo da empresa"/></label>
   <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={aiUse} onChange={e=>setAiUse(e.target.checked)}/>Gerar também um rascunho com IA (apenas por ação manual)</label>
  </section>
  {rows.map(r=><article key={r.id} className={card}>
   <div className="flex flex-wrap justify-between gap-2"><strong>{r.name} · v{r.version}</strong><span className="text-xs">{r.state} {r.tested_at?"· testado":""}</span></div>
   <p className="text-xs text-muted-foreground">{r.slug} · limite {r.max_calls} chamada(s) · {Array.isArray(r.tools)?r.tools.join(", "):""}</p>
   <div className="flex flex-wrap gap-2">
    {r.state==="rascunho"?<button className={ghost} disabled={busy} onClick={()=>void mutate(async()=>{const t=await testOpsAgentAction(r.id,cnj||undefined);setPreview(t.preview);return t;},"Validação do agente concluída.")}>Testar</button>:null}
    {r.state==="rascunho"&&r.tested_at?closeBtn("Publicar",()=>publishOpsAgentAction(r.id)):null}
    {r.state==="publicado"?<button className={ghost} disabled={busy||!cnj} onClick={()=>void mutate(async()=>{
     const result=await runOpsAgentAction({slug:r.slug,cnj,useIa:aiUse});
     setPreview([result.report,result.modelDraft,result.warning].filter(Boolean).join("\n\n"));
     return result;
    },"Execução manual concluída; confira o relatório.")}>Executar no processo</button>:null}
   </div>
  </article>)}
 </div>;
 const renderIntake=()=><div className="space-y-5">
  <section className={card}>
   <h2 className="font-bold">Criar formulário de documentos</h2>
   <label className={field}>Título<input className={input} value={formName} onChange={e=>setFormName(e.target.value)}/></label>
   <div className="space-y-2">{formFields.map((f,i)=><div key={f.key+i} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-2 text-xs">
    <span>{f.label} · {f.type} · {f.required?"obrigatório":"opcional"}</span>
    <button className={ghost} onClick={()=>setFormFields(old=>old.filter((_,j)=>i!==j))}>Remover</button>
   </div>)}</div>
   <div className="grid gap-2 sm:grid-cols-3">
    <input className={input} value={newFieldKey} onChange={e=>setNewFieldKey(e.target.value)} placeholder="chave_campo"/>
    <input className={input} value={newFieldLabel} onChange={e=>setNewFieldLabel(e.target.value)} placeholder="Nome do campo"/>
    <select className={input} value={newFieldType} onChange={e=>setNewFieldType(e.target.value as IntakeField["type"])}>
     <option value="text">Texto</option><option value="textarea">Texto longo</option><option value="email">E-mail</option><option value="phone">Telefone</option>
    </select>
   </div>
   <div className="flex flex-wrap gap-2">
    <button className={ghost} onClick={()=>{if(newFieldKey&&newFieldLabel){setFormFields(old=>[...old,{key:newFieldKey,label:newFieldLabel,type:newFieldType,required:false}]);setNewFieldKey("");setNewFieldLabel("");}}}>Adicionar campo</button>
    <button className={btn} disabled={busy||formFields.length===0} onClick={()=>void mutate(async()=>{
     const r=await createOpsIntakeFormAction({title:formName,fields:formFields,expiresInDays:30,maxSubmissions:100});
     setCreatedLink(window.location.origin+r.publicPath);return r;
    },"Formulário criado. Copie o link agora: ele não será exibido novamente.")}>Criar link válido por 30 dias</button>
   </div>
   {createdLink?<div className="rounded-lg border border-border bg-muted/50 p-3">
    <p className="text-xs font-bold">Link confidencial — copie agora</p>
    <p className="break-all text-xs">{createdLink}</p>
    <button className={ghost} onClick={()=>void navigator.clipboard.writeText(createdLink)}>Copiar link</button>
   </div>:null}
  </section>
  {rows.map(r=><article key={r.id} className={card}>
   <div className="flex flex-wrap justify-between gap-2"><strong>{r.title}</strong><span className="text-xs">{r.status} · {r.submissions_count}/{r.max_submissions}</span></div>
   <p className="text-xs text-muted-foreground">Expira: {new Date(r.expires_at).toLocaleDateString("pt-BR")}</p>
   <div className="flex flex-wrap gap-2">
    <button className={ghost} onClick={()=>void listOpsIntakeSubmissionsAction(r.id).then(setSubmissions).catch(e=>setError(e.message))}>Ver respostas</button>
    {r.status==="ativo"?closeBtn("Revogar link",()=>revokeOpsIntakeFormAction(r.id)):null}
   </div>
  </article>)}
  {submissions.length>0?<section className={card}><h3 className="font-bold">Respostas recebidas</h3>
   {submissions.map(s=><article key={s.id} className="space-y-2 rounded-lg border border-border p-3 text-xs">
    <p className="font-semibold">{new Date(s.created_at).toLocaleString("pt-BR")} · {s.reviewed_at?"Revisado":"Pendente"}</p>
    <dl>{Object.entries(s.answers||{}).filter(([k])=>!k.startsWith("_")).map(([k,v])=><div key={k} className="flex flex-wrap gap-1"><dt className="font-bold">{k}:</dt><dd>{String(v)}</dd></div>)}</dl>
    <div className="flex flex-wrap gap-2">{(s.attachments||[]).map((path:string)=><button key={path} className={ghost} onClick={()=>void getOpsAttachmentLinkAction(s.id,path).then(r=>window.open(r.url,"_blank","noopener,noreferrer")).catch(e=>setError(e.message))}>Abrir anexo seguro</button>)}
    {!s.reviewed_at?closeBtn("Marcar revisado",()=>reviewOpsIntakeSubmissionAction(s.id)):null}</div>
   </article>)}
  </section>:null}
 </div>;
 const renderPermissions=()=><div className="space-y-5">
  <section className={card}>
   <h2 className="font-bold">Permissões por ação</h2>
   <p className="text-xs text-muted-foreground">Somente administradores podem alterar acessos. A gestão de permissões não é delegável.</p>
   <label className={field}>Usuário<select className={input} value={grantUser} onChange={e=>setGrantUser(e.target.value)}><option value="">Selecionar</option>{users.map(u=><option key={u.auth_user_id} value={u.auth_user_id}>{u.nome} · {u.cargo||"sem cargo"}</option>)}</select></label>
   <label className={field}>Operação<select className={input} value={grantCap} onChange={e=>setGrantCap(e.target.value as OpsCapability)}>
    {OPS_CAPABILITIES.filter(x=>x!=="permissions.manage").map(c=><option key={c} value={c}>{c}</option>)}
   </select></label>
   <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={grantAllowed} onChange={e=>setGrantAllowed(e.target.checked)}/>{grantAllowed?"Permitir":"Negar"}</label>
   <button className={btn} disabled={!grantUser||busy} onClick={()=>void mutate(()=>setOpsGrantAction({userAuthId:grantUser,capability:grantCap,allowed:grantAllowed}),"Permissão salva com auditoria.")}>Salvar permissão</button>
   <button className={ghost} onClick={()=>void listOpsAuditAction().then(setAuditRows).catch(e=>setError(e.message))}>Ver ações auditadas</button>
  </section>
  {rows.map(r=><div key={r.id} className={card+" text-xs"}>
   <p><strong>{userLabel(r.user_auth_id)}</strong> · {r.capability} · {r.allowed?"permitido":"negado"}</p>
  </div>)}
  {auditRows.length>0?<section className={card}><h3 className="font-bold">Auditoria recente</h3>{auditRows.map(r=><p key={r.id} className="border-b border-border py-1 text-xs">{r.created_at} · {userLabel(r.actor_auth_id||"")} · {r.entity}/{r.event}</p>)}</section>:null}
 </div>;
 const renderCalls=()=><div className="space-y-5">
  <section className={card}>
   <h2 className="font-bold">Registrar ligação</h2>
   <p className="text-xs text-muted-foreground">Registro manual: nenhum provedor telefônico externo foi conectado. Transcrições exigem consentimento registrado.</p>
   <div className="grid gap-3 md:grid-cols-2">
    <label className={field}>Telefone<input className={input} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <label className={field}>CNJ (opcional)<input className={input} value={cnj} onChange={e=>setCnj(e.target.value)}/></label>
    <label className={field}>Tipo<select className={input} value={callDirection} onChange={e=>setCallDirection(e.target.value as typeof callDirection)}><option value="entrada">Recebida</option><option value="saida">Realizada</option></select></label>
    <label className={field}>Resultado<select className={input} value={callStatus} onChange={e=>setCallStatus(e.target.value as typeof callStatus)}><option value="realizada">Atendida</option><option value="nao_atendida">Não atendida</option><option value="falhou">Falhou</option></select></label>
   </div>
   <label className={field}>Anotações<textarea className={area} value={callNotes} onChange={e=>setCallNotes(e.target.value)}/></label>
   <label className={field}>Transcrição textual (opcional)<textarea className={area} value={transcript} onChange={e=>setTranscript(e.target.value)} maxLength={20000}/></label>
   <label className="flex gap-2 text-xs"><input type="checkbox" checked={consented} onChange={e=>setConsented(e.target.checked)}/>Confirmo que o consentimento para gravação/transcrição foi obtido.</label>
   <button className={btn} disabled={busy||!!transcript&&!consented} onClick={()=>void mutate(()=>createOpsCallAction({phone,cnj:cnj||undefined,direction:callDirection,status:callStatus,notes:callNotes,transcript,consentAt:consented?new Date().toISOString():undefined,transcriptSource:transcript?"operador":undefined}),"Ligação registrada na carteira.")}>Salvar ligação</button>
  </section>
  {rows.map(r=><article key={r.id} className={card}>
   <div className="flex flex-wrap justify-between gap-2"><strong>{r.phone} · {r.direction}</strong><span className="text-xs">{r.status}</span></div>
   <p className="text-xs text-muted-foreground">{r.cnj||"Sem CNJ"} · {new Date(r.created_at).toLocaleString("pt-BR")} · origem {r.provider}</p>
   {r.notes?<p className="text-sm">{r.notes}</p>:null}
   {r.transcript_source?<button className={ghost} onClick={()=>void getOpsCallTranscriptAction(r.id).then(x=>setPreview(x.transcript)).catch(e=>setError(e.message))}>Ver transcrição</button>:null}
  </article>)}
 </div>;
 const renderIntegrations=()=><div className="space-y-5">
  <section className={card}>
   <h2 className="font-bold">Verificar configuração e histórico</h2>
   <p className="text-xs text-muted-foreground">A checagem consulta sinais existentes no Lexis. Não simula comunicação com tribunal, Google ou WhatsApp.</p>
   <div className="flex flex-wrap gap-2">
    <select className={input+" max-w-xs"} value={provider} onChange={e=>setProvider(e.target.value as typeof provider)}>
     {integrations.map(p=><option key={p} value={p}>{p}</option>)}
    </select>
    <button className={btn} disabled={busy} onClick={()=>void mutate(()=>checkOpsIntegrationAction(provider),"Estado observado e registrado.")}>Verificar agora</button>
    <Link className={ghost} href="/integracoes">Integrações originais</Link>
   </div>
  </section>
  {rows.map(r=><article key={r.id} className={card}>
   <div className="flex flex-wrap justify-between gap-2"><strong>{r.provider}</strong><span className="text-xs">{r.state}</span></div>
   <p className="text-sm">{r.details}</p>
   <p className="text-xs text-muted-foreground">Conferido: {new Date(r.checked_at).toLocaleString("pt-BR")}</p>
  </article>)}
 </div>;
 return <div className="flex min-h-screen bg-background text-foreground">
  <Sidebar/>
  <main className="lexis-main-pad min-w-0 flex-1 px-4 py-5 md:px-8 md:py-8">
   <div className="mx-auto max-w-6xl space-y-6">
    <header className="space-y-3">
     <p className="text-xs font-bold uppercase tracking-widest text-primary">LexisPredict · Operações integradas</p>
     <h1 className="text-2xl font-black tracking-tight md:text-3xl">Fluxos, atendimento e agentes do escritório</h1>
     <p className="max-w-3xl text-sm text-muted-foreground">Recursos dos lotes 2 a 8. Dados empresariais separados por empresa, operações rastreadas e ações externas sob revisão humana.</p>
     <div className="flex flex-wrap gap-2"><Link className={ghost} href="/processos">Processos</Link><Link className={ghost} href="/tarefas">Tarefas</Link><Link className={ghost} href="/estudio-agentes">Estúdio de agentes</Link><Link className={ghost} href="/whatsapp">WhatsApp</Link></div>
    </header>
    <nav aria-label="Áreas de operação" className="flex flex-wrap gap-2">
     {tabs.map(t=><button key={t.id} title={t.detail} onClick={()=>{setTab(t.id);setPreview("");setNotice("");}}
       className={"rounded-xl border px-3 py-2 text-xs font-semibold transition-colors "+(tab===t.id?"border-[#7c2d48] bg-[#69243c] text-white":"border-border bg-card hover:bg-muted")}>{t.label}</button>)}
    </nav>
    {error?<div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">{error}</div>:null}
    {notice?<div role="status" className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{notice}</div>:null}
    {busy?<p className="text-xs text-muted-foreground">Atualizando operação...</p>:null}
    {tab==="workflow"?renderWorkflows():
     tab==="inbox"?renderInbox():
     tab==="agents"?renderAgents():
     tab==="intake"?renderIntake():
     tab==="permissions"?renderPermissions():
     tab==="calls"?renderCalls():renderIntegrations()}
    {preview?<section className={card}><h2 className="font-bold">Detalhes e revisão</h2><pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">{preview}</pre><button className={ghost} onClick={()=>setPreview("")}>Fechar</button></section>:null}
   </div>
  </main>
 </div>;
}
