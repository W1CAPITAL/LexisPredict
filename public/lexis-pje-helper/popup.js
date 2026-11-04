'use strict';

const state=document.getElementById('state');
const actions=document.getElementById('actions');
const refresh=document.getElementById('refresh');

function findOnCourtPage() {
  function labelOf(element) {
    const parts=[
      element.getAttribute('title'),
      element.getAttribute('aria-label'),
      element.getAttribute('data-original-title'),
      element.getAttribute('data-tooltip'),
      element.getAttribute('value'),
      (element.innerText||element.textContent||'').trim(),
      element.className&&typeof element.className==='string'?element.className:''
    ].filter(Boolean);
    return parts.join(' ').replace(/\s+/g,' ').trim().slice(0,180);
  }
  function safeDownloadControl(label) {
    const text=label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/assinar|protocolo|peticionar|juntar|enviar|excluir|remover|atualizar|login|sair|autenticar/.test(text))return false;
    return /(baixar|download|exportar)/.test(text)&&
      /(autos|documento|processo|arquivo|pdf|inteiro teor)/.test(text);
  }
  const nodes=Array.from(document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]'));
  const picks=[];
  for(const node of nodes){
    if(picks.length>=20)break;
    if(!node.isConnected || node.getClientRects().length===0)continue;
    const title=labelOf(node);
    if(!safeDownloadControl(title))continue;
    node.setAttribute('data-lexis-pje-action',String(picks.length));
    picks.push({id:picks.length,label:title.slice(0,95)||'Download oficial',tag:node.tagName.toLowerCase()});
  }
  const cnj=(document.body.innerText||'').match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0]||null;
  return {count:picks.length,processo:cnj,buttons:picks};
}
function clickCourtOption(id) {
  function labelOf(element) {
    const parts=[
      element.getAttribute('title'),
      element.getAttribute('aria-label'),
      element.getAttribute('data-original-title'),
      element.getAttribute('data-tooltip'),
      element.getAttribute('value'),
      (element.innerText||element.textContent||'').trim(),
      element.className&&typeof element.className==='string'?element.className:''
    ].filter(Boolean);
    return parts.join(' ').replace(/\s+/g,' ').trim().slice(0,180);
  }
  function safeDownloadControl(label) {
    const text=label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/assinar|protocolo|peticionar|juntar|enviar|excluir|remover|atualizar|login|sair|autenticar/.test(text))return false;
    return /(baixar|download|exportar)/.test(text)&&
      /(autos|documento|processo|arquivo|pdf|inteiro teor)/.test(text);
  }
  const candidate=document.querySelector('[data-lexis-pje-action="'+String(id)+'"]');
  if(!candidate)return {ok:false,reason:'A página mudou. Procure as opções novamente.'};
  const title=labelOf(candidate);
  if(!safeDownloadControl(title))return {ok:false,reason:'Este botão não é uma ação de download permitida.'};
  candidate.scrollIntoView({block:'center',behavior:'smooth'});
  candidate.click();
  return {ok:true,reason:'Comando oficial acionado. Se o PJe abrir uma janela, confirme a exportação nela.'};
}
async function activeCourtTab(){
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  const tab=tabs[0];
  if(!tab?.id||!tab.url)return null;
  const url=new URL(tab.url);
  if(url.protocol!=='https:' || !(url.hostname==='jus.br'||url.hostname.endsWith('.jus.br')))return null;
  return tab;
}
async function scan(){
  actions.replaceChildren();
  state.textContent='Analisando os controles da aba PJe…';
  const tab=await activeCourtTab();
  if(!tab){state.textContent='Abra a tela de autos em um portal oficial *.jus.br e clique novamente na extensão.';return;}
  try{
    const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:findOnCourtPage});
    const data=result[0]?.result;
    if(!data){state.textContent='Não foi possível ler a aba ativa. Verifique as permissões da extensão.';return;}
    if(!data.count){
      state.textContent='Não encontrei comando de exportação acessível nesta tela. Abra os autos digitais e use o menu oficial de download do tribunal.';
      return;
    }
    state.textContent=(data.processo?'Processo '+data.processo+' · ':'')+data.count+' opção(ões) de exportação encontradas:';
    for(const option of data.buttons){
      const button=document.createElement('button');
      button.type='button';
      button.className='action';
      button.textContent=option.label;
      button.addEventListener('click',async()=>{
        button.disabled=true;
        try{
          const returned=await chrome.scripting.executeScript({
            target:{tabId:tab.id},
            func:clickCourtOption,args:[option.id]
          });
          const status=returned[0]?.result;
          state.textContent=status?.reason||'Comando enviado ao tribunal.';
          if(status?.ok){
            actions.replaceChildren();
            const hint=document.createElement('p');
            hint.className='muted';
            hint.textContent='Se a exportação abriu uma janela no PJe, escolha a opção de todos os documentos e confirme no próprio site. Depois importe o PDF/ZIP no scanner gratuito.';
            actions.appendChild(hint);
          }
        }catch{
          state.textContent='O portal não aceitou a ação automática. Use o botão de download diretamente no PJe.';
        }finally{button.disabled=false;}
      });
      actions.appendChild(button);
    }
  }catch{
    state.textContent='Não foi possível acessar os controles deste portal. Use a exportação oficial do tribunal.';
  }
}
refresh.addEventListener('click',()=>{void scan();});
void scan();
