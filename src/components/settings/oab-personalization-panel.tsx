"use client";

import * as React from 'react';
import Link from 'next/link';
import {CheckCircle2,ExternalLink,Loader2,Settings2,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {getExperienceAction,saveOabPreferencesAction} from '@/app/actions/experience-actions';
import {EXPERIENCE_DEFAULT,cleanExperiencePrefs,applyExperiencePrefs,loadExperiencePrefs,type ExperiencePreferences} from '@/lib/experience-prefs';
import {TODOS_TRIBUNAIS} from '@/lib/tribunais-links';

type OabPrefs=Pick<ExperiencePreferences,'oabNumber'|'oabUf'|'oabCertificateType'|'oabPreferredTribunal'|'oabDefaultDocuments'|'oabShowGuide'>;
const oabKeys=(x:ExperiencePreferences):OabPrefs=>({
 oabNumber:x.oabNumber,oabUf:x.oabUf,oabCertificateType:x.oabCertificateType,
 oabPreferredTribunal:x.oabPreferredTribunal,oabDefaultDocuments:x.oabDefaultDocuments,oabShowGuide:x.oabShowGuide
});
const field='w-full min-h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const label='block text-xs font-bold text-foreground mb-1';
const UFS=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
export function OabPersonalizationPanel(){
 const [prefs,setPrefs]=React.useState<OabPrefs>(oabKeys(EXPERIENCE_DEFAULT));
 const [busy,setBusy]=React.useState(false);
 const [loading,setLoading]=React.useState(true);
 const [error,setError]=React.useState('');
 const [success,setSuccess]=React.useState('');
 React.useEffect(()=>{
  let cancelled=false;
  void (async()=>{
   const result=await getExperienceAction();
   if(cancelled)return;
   if(result.ok){
     const current=cleanExperiencePrefs(result.profile?.preferences||loadExperiencePrefs());
     setPrefs(oabKeys(current));
   } else setError(result.error||'Não foi possível carregar a personalização.');
   setLoading(false);
  })();
  return ()=>{cancelled=true;};
 },[]);
 const set=<K extends keyof OabPrefs>(key:K,value:OabPrefs[K])=>{
   setSuccess('');setPrefs(prev=>({...prev,[key]:value}));
 };
 async function save(){
  if(busy)return;
  setError('');setSuccess('');setBusy(true);
  try{
   const response=await saveOabPreferencesAction(prefs);
   if(!response.ok)throw Error(response.error);
   const verified=cleanExperiencePrefs(response.preferences);
   applyExperiencePrefs(verified);
   setPrefs(oabKeys(verified));
   setSuccess('Preferências OAB salvas no seu perfil. Elas serão utilizadas na próxima consulta.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}
  finally{setBusy(false);}
 }
 return <section className="space-y-5" aria-label="Personalização OAB">
  <header className="space-y-2">
   <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={20} className="text-primary"/> Consulta OAB e certificado</h2>
   <p className="text-sm text-muted-foreground">Escolha uma vez como você consulta os tribunais. Sua inscrição OAB e preferências ficam vinculadas ao perfil; senha, PIN e certificado não são solicitados nem armazenados.</p>
  </header>
  {loading?<p className="text-sm flex items-center gap-2"><Loader2 size={15} className="animate-spin"/> Carregando preferências…</p>:
   <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label><span className={label}>UF da OAB</span>
       <select className={field} value={prefs.oabUf} onChange={e=>set('oabUf',e.target.value)}><option value="">Não informada</option>{UFS.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select>
      </label>
      <label><span className={label}>Número da OAB (opcional)</span>
       <input className={field} inputMode="numeric" maxLength={14} autoComplete="off" value={prefs.oabNumber} placeholder="Ex.: 52996-A" onChange={e=>set('oabNumber',e.target.value.toUpperCase().replace(/[^0-9A-Z.\-/\s]/g,'').slice(0,14))}/>
      </label>
      <label><span className={label}>Método de acesso habitual</span>
       <select className={field} value={prefs.oabCertificateType} onChange={e=>set('oabCertificateType',e.target.value as OabPrefs['oabCertificateType'])}>
        <option value="a3">Certificado A3 · token ou cartão</option>
        <option value="a1">Certificado A1 · instalado no computador</option>
        <option value="none">Sem certificado configurado (consulta pública)</option>
       </select>
      </label>
      <label><span className={label}>Tribunal favorito</span>
       <select className={field} value={prefs.oabPreferredTribunal} onChange={e=>set('oabPreferredTribunal',e.target.value)}>
        <option value="">Detectar automaticamente pelo CNJ</option>
        {TODOS_TRIBUNAIS.map(row=><option value={row.codigo} key={row.codigo}>{row.sigla} · {row.nome}</option>)}
       </select>
      </label>
      <label><span className={label}>Pacote de documentos padrão</span>
       <select className={field} value={prefs.oabDefaultDocuments} onChange={e=>set('oabDefaultDocuments',e.target.value as OabPrefs['oabDefaultDocuments'])}>
         <option value="contestacao">Até a primeira possível contestação</option>
         <option value="todos">Todos os PDFs exportados</option>
       </select>
      </label>
      <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2">
       <input type="checkbox" className="accent-primary" checked={prefs.oabShowGuide} onChange={e=>set('oabShowGuide',e.target.checked)}/>
       <span className="text-sm text-foreground">Mostrar ajuda na consulta</span>
      </label>
    </div>
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs leading-5 text-foreground">
     <p className="font-bold">Seu certificado permanece no tribunal</p>
     <p className="text-muted-foreground">O LexisPredict não consegue operar o PJeOffice diretamente, porque esse assinador atende aplicações de domínios judiciais e governamentais. O login deve ser feito na própria página do tribunal. A consulta OAB organiza os arquivos depois da exportação.</p>
     <a className="mt-1 inline-flex items-center gap-1 text-primary underline" href="https://docs.pje.jus.br/servicos-negociais/pjeoffice-pro/" target="_blank" rel="noopener noreferrer">Guia oficial de instalação do PJeOffice Pro <ExternalLink size={12}/></a>
    </div>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {success&&<p role="status" className="flex items-center gap-2 text-sm text-foreground"><CheckCircle2 size={15} className="text-primary"/>{success}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={()=>void save()}>{busy?<Loader2 size={14} className="mr-2 animate-spin"/>:<Settings2 size={14} className="mr-2"/>} Salvar preferências OAB</Button>
      <Button asChild variant="outline"><Link href="/consulta-oab">Abrir consulta OAB</Link></Button>
    </div>
   </div>}
 </section>;
}
