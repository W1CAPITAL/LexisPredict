"use client";
import {useEffect,useState,useRef} from 'react';
import {useAuth} from '@/components/auth/auth-provider';
import {usePathname} from 'next/navigation';
import {X,ArrowLeft,ArrowRight,Check,ShieldCheck,Upload,Palette,PanelLeft,Type,LayoutDashboard,UserCircle,Loader2} from 'lucide-react';
import {getExperienceAction,saveExperienceAction,uploadExperienceImageAction} from '@/app/actions/experience-actions';
import {EXPERIENCE_TERMS,EXPERIENCE_TERMS_VERSION} from '@/lib/experience-terms';
import {EXPERIENCE_DEFAULT,cleanExperiencePrefs,applyExperiencePrefs,type ExperiencePreferences} from '@/lib/experience-prefs';
import {AUTHORITY_PRESETS,getPresetColors} from '@/lib/theme';

type ExperienceRecord={display_name?:string;display_role?:string;phone?:string;preferences?:unknown;onboarding_version?:number;terms_version?:string;welcome_opt_in?:boolean};
type StudioProps={
 wizard:boolean;
 record?:ExperienceRecord|null;
 user?:{nome?:string|null;cargo?:string|null;avatar_url?:string|null}|null;
 onDone?:()=>void;
 onClose?:()=>void;
};
const themes=AUTHORITY_PRESETS.map(p=>[p.id,p.name] as const);
const wallPresets=[
 ['','Sem imagem'],
 ['https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80','Terra noturna'],
 ['https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1600&q=80','Céu noturno'],
] as const;
const tabs=[
 ['/','Dashboard'],['/cases','Meus processos'],['/processos','Processos da empresa'],
 ['/tarefas','Tarefas'],['/whatsapp','WhatsApp'],['/report','Relatórios'],
 ['/agenda','Agenda'],['/dossies','Dossiês'],['/crm','CRM'],
] as const;
const selectClass='w-full rounded-xl border border-border bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
const labelClass='block text-xs font-semibold text-muted-foreground mb-1';
const fieldClass='w-full min-h-11 rounded-xl border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
const stageNames=['Seu perfil','Aparência','Navegação e componentes','Responsabilidade e licença'];
const TITLE='Sua experiência LexisPredict';

export function ExperienceStudio({wizard,record,user,onDone,onClose}:StudioProps){
 const [step,setStep]=useState(0);
 const [prefs,setPrefs]=useState<ExperiencePreferences>(()=>cleanExperiencePrefs(record?.preferences||{}));
 const [wallpaperDraft,setWallpaperDraft]=useState(()=>cleanExperiencePrefs(record?.preferences||{}).wallpaper);
 const [name,setName]=useState(record?.display_name||user?.nome||'');
 const [role,setRole]=useState(record?.display_role||user?.cargo||'');
 const [phone,setPhone]=useState(record?.phone||'');
 const [accepted,setAccepted]=useState(false);
 const [welcome,setWelcome]=useState(record?.welcome_opt_in===true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState(false);
 const imageRef=useRef<HTMLInputElement>(null);
 const avatarRef=useRef<HTMLInputElement>(null);
 const set=<K extends keyof ExperiencePreferences>(key:K,value:ExperiencePreferences[K])=>
  setPrefs(p=>({...p,[key]:value}));
 useEffect(()=>{
  const saved=cleanExperiencePrefs(record?.preferences||{});
  setPrefs(saved);
  setWallpaperDraft(saved.wallpaper);
  setName(record?.display_name||user?.nome||'');
  setRole(record?.display_role||user?.cargo||'');
  setPhone(record?.phone||'');
 },[record?.display_name,record?.phone,record?.preferences,user?.nome,user?.cargo]);
 // Evita recálculo global de CSS/fundo a cada tecla e a cada render do guia.
 // O modo de edição preserva pré-visualização, mas usa debounce leve.
 useEffect(()=>{
  if(step!==1&&step!==2)return;
  const task=window.setTimeout(()=>applyExperiencePrefs(prefs),500);
  return()=>window.clearTimeout(task);
 },[prefs,step]);
 useEffect(()=>{
  // URLs só são testadas quando confirmadas; evita dezenas de downloads enquanto
  // a pessoa ainda digita ou cola a imagem.
  setWallpaperDraft(prefs.wallpaper);
 },[prefs.wallpaper]);
 const upload=async(file:File|undefined,kind:'avatar'|'wallpaper')=>{
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>3*1024*1024){
   setError('Escolha uma imagem PNG, JPG ou WebP de até 3 MB.');return;
  }
  setUploading(true);setError('');
  try{
   const data=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;
    reader.readAsDataURL(file);
   });
   const result=await uploadExperienceImageAction(data,kind);
   if(!result.ok)throw Error(result.error);
   set(kind==='avatar'?'avatarUrl':'wallpaper',result.url);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível enviar a imagem')}
  finally{setUploading(false)}
 };
 const next=()=>{
  setError('');
  if(step===0){
   if(name.trim().length<2){setError('Informe o nome que deseja exibir no perfil.');return;}
   if(!/^\+?55\d{10,11}$/.test(phone.replace(/\D/g,'').replace(/^(?!55)/,'55'))){setError('Número obrigatório: informe DDD e WhatsApp brasileiro.');return;}
  }
  setStep(n=>Math.min(3,n+1));
 };
 const save=async()=>{
  setBusy(true);setError('');
  const complete=wizard||!record?.terms_version;
  try{
   const r=await saveExperienceAction({
    name,roleLabel:role,phone,preferences:prefs,complete,
    acceptTerms:complete?accepted:undefined,
    signature:complete?name.trim():undefined,welcomeOptIn:welcome,
   });
   if(!r.ok)throw Error(r.error);
   applyExperiencePrefs(r.preferences);
   window.dispatchEvent(new CustomEvent('lexis-profile-appearance',{detail:{
    name:name.trim(),role:role.trim(),avatar:r.preferences.avatarUrl,
   }}));
   onDone?.();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.')}
  finally{setBusy(false)}
 };
 return (
  <div className={wizard?'fixed inset-0 z-[250] grid place-items-center bg-slate-950/80 p-2 sm:p-6':'w-full'}>
   <section role={wizard?'dialog':undefined} aria-modal={wizard?'true':undefined}
    aria-label={TITLE}
    className="w-full max-w-5xl overflow-hidden rounded-[24px] border border-border bg-card text-card-foreground shadow-2xl"
    style={{maxHeight:wizard?'min(95dvh,940px)':undefined}}>
    <header className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-4 sm:px-6">
     <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Palette className="h-6 w-6"/></div>
     <div className="min-w-0 flex-1">
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">LEXISPREDICT · EXPERIÊNCIA PESSOAL</p>
      <h2 className="text-lg font-extrabold sm:text-xl">{wizard?'Bem-vindo! Personalize seu espaço de trabalho':TITLE}</h2>
      <p className="text-xs text-muted-foreground">{wizard?'Este guia aparece nesta atualização para cada usuário; suas escolhas ficam salvas no seu perfil.':'Altere quando quiser; não muda permissões de acesso.'}</p>
     </div>
     {!wizard&&onClose?<button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5"/></button>:null}
    </header>
    <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-3 sm:px-6">
     {stageNames.map((item,i)=>(
      <button key={item} type="button" onClick={()=>setStep(i)}
       className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${i===step?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground hover:text-foreground'}`}>
       {i<step?<Check className="mr-1 inline h-3 w-3"/>:null}{i+1}. {item}
      </button>
     ))}
    </div>
    <div className="overflow-y-auto px-4 py-5 sm:px-7" style={{maxHeight:wizard?'min(62dvh,645px)':'65dvh'}}>
     {step===0?<div className="grid gap-5 md:grid-cols-[180px_1fr]">
      <div className="space-y-3">
       <div className="grid h-36 w-36 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted">
        {(prefs.avatarUrl||user?.avatar_url)?<img className="h-full w-full object-cover" src={prefs.avatarUrl||user?.avatar_url||''} alt="Sua foto"/>:<UserCircle className="h-16 w-16 text-muted-foreground"/>}
       </div>
       <button type="button" disabled={uploading} onClick={()=>avatarRef.current?.click()} className="rounded-lg border px-3 py-2 text-xs font-bold"><Upload className="mr-1 inline h-3 w-3"/>Alterar foto</button>
       <input ref={avatarRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void upload(e.target.files?.[0],'avatar')}/>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
       <label className="block"><span className={labelClass}>Nome do perfil *</span><input className={fieldClass} value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label>
       <label className="block"><span className={labelClass}>Cargo exibido no seu perfil</span><input className={fieldClass} value={role} onChange={e=>setRole(e.target.value)} maxLength={70} placeholder="Ex.: Analista processual"/></label>
       <label className="block sm:col-span-2"><span className={labelClass}>WhatsApp de contato com DDD *</span><input type="tel" inputMode="tel" className={fieldClass} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(11) 99999-9999" required/></label>
       <label className="flex items-start gap-3 sm:col-span-2 rounded-xl border border-border bg-muted/30 p-4">
        <input type="checkbox" checked={welcome} onChange={e=>setWelcome(e.target.checked)} className="mt-1 h-4 w-4"/>
        <span className="text-sm"><strong>Quero receber uma mensagem de boas-vindas no meu WhatsApp.</strong>
         <span className="mt-1 block text-xs text-muted-foreground">Consentimento opcional e separado, para uma única mensagem do LexisPredict. O número é obrigatório para o perfil, mas a mensagem não é.</span></span>
       </label>
       <p className="sm:col-span-2 text-xs text-muted-foreground">O cargo informado aqui é apenas visual. Seu perfil de segurança e as permissões definidas pelo administrador permanecem iguais.</p>
      </div>
     </div>:null}
     {step===1?<div className="space-y-5">
      <div><p className={labelClass}>Tema visual</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
       {themes.map(([id,title])=>{
        const theme=AUTHORITY_PRESETS.find(x=>x.id===id);
        if(!theme)return null;
        const variant=(prefs.theme===id?prefs.mode:theme.preferredMode||prefs.mode)==='dark'?'dark':'light';
        const palette=getPresetColors(theme,variant);
        const selected=prefs.theme===id;
        return <button key={id} type="button" aria-pressed={selected} onClick={()=>{
          // Ao escolher um tema, aplicar sua paleta completa e o modo indicado
          // pela própria paleta, sem conservar fundos customizados antigos.
          const nextMode=theme.preferredMode||prefs.mode;
          const nextPalette=getPresetColors(theme,nextMode==='dark'?'dark':'light');
          setPrefs(p=>({...p,theme:id,mode:nextMode,primary:nextPalette.primary,
            backgroundColor:'',cardColor:'',sidebarColor:'',textColor:'',mutedTextColor:''}));
        }}
        className={`rounded-xl border p-2.5 text-left text-xs font-bold transition-colors ${selected?'border-primary ring-2 ring-primary/30':'border-border hover:border-primary/50'}`}>
         <span className="mb-2 flex h-11 items-center gap-2 overflow-hidden rounded-lg border p-2"
          style={{background:`linear-gradient(120deg,${palette.background},${palette.bgSecondary})`,borderColor:palette.border}}>
          <span className="h-7 w-2 rounded-sm" style={{background:palette.nav||'#102843'}}/>
          <span className="flex flex-1 flex-col gap-1">
           <span className="h-1.5 w-3/4 rounded-sm" style={{background:palette.foreground}}/>
           <span className="h-1.5 w-1/2 rounded-sm" style={{background:palette.fontMuted}}/>
          </span>
          <span className="h-5 w-5 rounded-md" style={{background:palette.primary}}/>
         </span>
         <span className="text-card-foreground">{title}</span>
        </button>;
       })}
      </div></div>
      <div className="grid gap-4 sm:grid-cols-3">
       <label><span className={labelClass}>Modo</span><select className={selectClass} value={prefs.mode} onChange={e=>set('mode',e.target.value as ExperiencePreferences['mode'])}><option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Automático pelo dispositivo</option></select></label>
       <label><span className={labelClass}>Fonte</span><select value={prefs.font} className={selectClass} onChange={e=>set('font',e.target.value as ExperiencePreferences['font'])}>{['Inter','Roboto','Poppins','Georgia','Arial'].map(x=><option key={x}>{x}</option>)}</select></label>
       <label><span className={labelClass}>Arredondamento: {prefs.cornerRadius}px</span><input className="mt-3 w-full accent-primary" type="range" min="0" max="32" value={prefs.cornerRadius} onChange={e=>set('cornerRadius',Number(e.target.value))}/></label>
       {([['primary','Cor principal'],['textColor','Cor das letras'],['mutedTextColor','Texto secundário'],['backgroundColor','Fundo do aplicativo'],['cardColor','Fundo dos cards'],['sidebarColor','Cor da navegação']] as const).map(([k,title])=><label key={k} className="flex items-center gap-3 rounded-lg border p-2"><input type="color" value={(prefs[k]||'#64748b')} onChange={e=>set(k,e.target.value)} className="h-8 w-9 cursor-pointer"/><span className="text-xs font-semibold">{title}</span></label>)}
       <button type="button" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground" onClick={()=>setPrefs(p=>({...p,backgroundColor:'',cardColor:'',sidebarColor:'',textColor:'',mutedTextColor:''}))}>Restaurar cores do tema</button>
      </div>
      <div>
       <span className={labelClass}>Imagem de fundo (opcional)</span>
       <div className="flex flex-wrap gap-2">{wallPresets.map(([url,label])=><button key={label} onClick={()=>set('wallpaper',url)} type="button" className={`rounded-lg border px-3 py-2 text-xs ${prefs.wallpaper===url?'border-primary bg-primary/10':'border-border'}`}>{label}</button>)}
        <button type="button" disabled={uploading} onClick={()=>imageRef.current?.click()} className="rounded-lg border px-3 py-2 text-xs"><Upload className="mr-1 inline h-3 w-3"/>Enviar imagem própria (até 3 MB)</button>
       </div>
       <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>void upload(e.target.files?.[0],'wallpaper')}/>
       <input type="url" value={wallpaperDraft} onChange={e=>setWallpaperDraft(e.target.value)}
        onBlur={()=>set('wallpaper',wallpaperDraft.trim())}
        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();set('wallpaper',wallpaperDraft.trim())}}}
        className={fieldClass+' mt-2'} placeholder="Ou cole uma URL HTTPS da imagem"/>
       {prefs.wallpaper?(
        <div className="mt-2 space-y-1 rounded-lg border border-border p-2">
         <p className="text-xs font-semibold text-foreground">Prévia do plano de fundo selecionado</p>
         <img src={prefs.wallpaper} alt="Prévia do plano de fundo" loading="lazy" className="h-28 w-full rounded-lg bg-muted object-cover"
          onError={()=>setError('A imagem não pôde ser carregada. Confira a URL ou escolha outra imagem.')} />
         <p className="text-xs text-muted-foreground">O papel de parede é aplicado atrás dos painéis e permanece salvo no perfil ao finalizar.</p>
        </div>
       ):null}
      </div>
     </div>:null}
     {step===2?<div className="grid gap-4 sm:grid-cols-2">
      <label><span className={labelClass}>Posição da navegação</span><select className={selectClass} value={prefs.sidebarPosition} onChange={e=>set('sidebarPosition',e.target.value as ExperiencePreferences['sidebarPosition'])}><option value="left">Esquerda</option><option value="right">Direita</option><option value="top">Superior</option><option value="bottom">Inferior</option></select></label>
      <label><span className={labelClass}>Como a sidebar aparece?</span><select className={selectClass} value={prefs.sidebarBehavior} onChange={e=>set('sidebarBehavior',e.target.value as ExperiencePreferences['sidebarBehavior'])}><option value="fixed">Fixa</option><option value="toggle">Oculta até tocar na seta</option><option value="floating">Flutuante</option></select></label>
      <label><span className={labelClass}>Aba favorita</span><select className={selectClass} value={prefs.favoriteTab} onChange={e=>set('favoriteTab',e.target.value)}>{tabs.map(([path,title])=><option key={path} value={path}>{title}</option>)}</select></label>
      <label><span className={labelClass}>Densidade de informações</span><select className={selectClass} value={prefs.density} onChange={e=>set('density',e.target.value as ExperiencePreferences['density'])}><option value="compact">Compacta</option><option value="comfortable">Equilibrada</option><option value="wide">Espaçosa</option></select></label>
      <label><span className={labelClass}>Estilo dos cards</span><select className={selectClass} value={prefs.cardStyle} onChange={e=>set('cardStyle',e.target.value as ExperiencePreferences['cardStyle'])}><option value="solid">Sólidos</option><option value="outlined">Contorno</option><option value="glass">Vidro fosco</option><option value="elevated">Elevados</option></select></label>
      <label><span className={labelClass}>Indicadores KPI</span><select className={selectClass} value={prefs.kpiStyle} onChange={e=>set('kpiStyle',e.target.value as ExperiencePreferences['kpiStyle'])}><option value="normal">Padrão</option><option value="compact">Compactos</option><option value="gradient">Destaques em gradiente</option></select></label>
      <label><span className={labelClass}>Botões</span><select className={selectClass} value={prefs.buttonStyle} onChange={e=>set('buttonStyle',e.target.value as ExperiencePreferences['buttonStyle'])}><option value="rounded">Arredondados</option><option value="pill">Pílula</option><option value="square">Retos</option></select></label>
      <label><span className={labelClass}>Notificações</span><select className={selectClass} value={prefs.notifications} onChange={e=>set('notifications',e.target.value as ExperiencePreferences['notifications'])}><option value="all">Todas</option><option value="important">Somente importantes</option><option value="silent">Silenciosas</option></select></label>
      <label className="sm:col-span-2"><span className={labelClass}>Frase do seu dashboard</span><input maxLength={150} className={fieldClass} value={prefs.dashboardPhrase} onChange={e=>set('dashboardPhrase',e.target.value)} placeholder="Ex.: Foco, excelência e resultado."/></label>
      <label className="flex gap-3 rounded-xl border p-3"><input type="checkbox" checked={prefs.glass} onChange={e=>set('glass',e.target.checked)}/><span className="text-sm">Ativar Glass/Blur nos componentes</span></label>
      <label><span className={labelClass}>Intensidade de blur: {prefs.blur}px</span><input type="range" min="0" max="28" value={prefs.blur} onChange={e=>set('blur',Number(e.target.value))} className="mt-3 w-full"/></label>
      <label className="flex gap-3 rounded-xl border p-3"><input type="checkbox" checked={prefs.sidebarCompact} onChange={e=>set('sidebarCompact',e.target.checked)}/><span className="text-sm">Menu compacto</span></label>
     </div>:null}
     {step===3?<div className="space-y-4">
      <p className="text-sm font-bold">Termos de responsabilidade, licença e tratamento de dados</p>
      <p className="text-xs text-muted-foreground">Versão {EXPERIENCE_TERMS_VERSION}. Aceite eletrônico simples; o contrato comercial formal, quando exigido, deve ser assinado separadamente.</p>
      <div className="max-h-56 overflow-y-auto rounded-xl border bg-muted/30 p-4 space-y-3" tabIndex={0} aria-label="Leia os termos completos">
       {EXPERIENCE_TERMS.map(t=><section key={t.title}><h3 className="text-sm font-bold">{t.title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.body}</p></section>)}
      </div>
      {wizard||!record?.terms_version?<><label className="flex gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Li, compreendi e aceito expressamente esta versão dos termos e das responsabilidades de uso.</span></label>
       <div className="rounded-xl border border-border bg-muted/30 p-3"><p className={labelClass}>Assinatura eletrônica com seu nome de perfil</p><p className="text-sm font-semibold text-foreground">{name.trim()||'Informe o nome do perfil na primeira etapa'}</p><p className="mt-1 text-xs text-muted-foreground">Ao selecionar a caixa de aceite e confirmar, este nome será registrado como sua assinatura eletrônica simples.</p></div>
      </>:<div className="rounded-xl border border-border p-3 text-xs">Seu aceite anterior está registrado. Alterar a aparência não renova o contrato.</div>}
      <p className="text-xs text-muted-foreground">O aceite será vinculado à sua conta e à versão do documento, com data e hora no servidor. Esta confirmação não substitui assinatura qualificada quando legalmente exigida.</p>
     </div>:null}
    </div>
    <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:px-6">
     <div className="min-w-0"><p className="text-xs text-muted-foreground">{step+1} de 4 · {stageNames[step]}</p>{error?<p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>:null}</div>
     <div className="flex gap-2">
      {step>0?<button type="button" onClick={()=>{setStep(x=>x-1);setError('')}} disabled={busy} className="rounded-xl border px-3 py-2 text-xs font-semibold"><ArrowLeft className="mr-1 inline h-4 w-4"/>Voltar</button>:null}
      {step<3?<button type="button" onClick={next} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">Continuar<ArrowRight className="ml-2 inline h-4 w-4"/></button>:
       <button type="button" onClick={()=>void save()} disabled={busy||uploading} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">{busy?<Loader2 className="mr-1 inline h-4 w-4 animate-spin"/>:<ShieldCheck className="mr-1 inline h-4 w-4"/>}{wizard?'Assinar e começar':'Salvar experiência'}</button>}
     </div>
    </footer>
   </section>
  </div>
 );
}

export function ExperienceGate(){
 const [data,setData]=useState<Awaited<ReturnType<typeof getExperienceAction>>|null>(null);
 const [done,setDone]=useState(false);
 const [loading,setLoading]=useState(false);
 const loadedUser=useRef('');
 const {user,profile}=useAuth();
 const path=usePathname();
 useEffect(()=>{
  if(!user?.id||!profile?.empresa_id||profile.empresa_id==='guest-local')return;
  if(['/login','/signup','/primeiro-acesso','/setup-empresa','/termos'].some(x=>path===x))return;
  const key=String(user.id)+':'+String(profile.empresa_id);
  if(loadedUser.current===key)return;
  loadedUser.current=key;
  let active=true;
  setLoading(true);
  getExperienceAction().then(r=>{if(active){setData(r);if(!r.ok)loadedUser.current=''}}).catch(()=>{loadedUser.current=''}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[user?.id,profile?.empresa_id,path]);
 useEffect(()=>{
  if(data?.ok){
   if(data.profile?.preferences)applyExperiencePrefs(cleanExperiencePrefs(data.profile.preferences));
   window.dispatchEvent(new CustomEvent('lexis-profile-appearance',{detail:{
     name:data.profile?.display_name||data.user?.nome||'',
     role:data.profile?.display_role||data.user?.cargo||'',
     avatar:cleanExperiencePrefs(data.profile?.preferences||{}).avatarUrl||data.user?.avatar_url||'',
   }}));
  }
 },[data]);
 if(done||loading||!data?.ok)return null;
 const d=data.profile;
 if(d&&Number(d.onboarding_version)>=4&&d.terms_version===EXPERIENCE_TERMS_VERSION&&d.phone)return null;
 if(['/login','/signup','/primeiro-acesso','/setup-empresa','/termos'].some(x=>path===x))return null;
 return <ExperienceStudio wizard record={d||null} user={data.user} onDone={()=>setDone(true)}/>;
}

export function ExperienceSettingsPanel(){
 const [opened,setOpened]=useState(false);
 const [data,setData]=useState<Awaited<ReturnType<typeof getExperienceAction>>|null>(null);
 useEffect(()=>{getExperienceAction().then(setData).catch(()=>{})},[]);
 if(!data?.ok)return null;
 return <section className="mb-5 rounded-2xl border border-primary/25 bg-card p-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Novo · Meu visual</p>
     <h3 className="text-lg font-bold">Estúdio de personalização</h3>
     <p className="text-xs text-muted-foreground">Temas, wallpaper, fonte, contrastes, sidebar, dashboard, cards e notificações. Sincronizado com sua conta.</p>
    </div>
    <button onClick={()=>setOpened(true)} type="button" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Personalizar experiência</button>
   </div>
   {opened?<ExperienceStudio wizard={false} record={data.profile||null} user={data.user}
     onClose={()=>{applyExperiencePrefs(cleanExperiencePrefs(data.profile?.preferences));setOpened(false)}}
     onDone={()=>{setOpened(false);getExperienceAction().then(setData)}}/>:null}
  </section>
}
