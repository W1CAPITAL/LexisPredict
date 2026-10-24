/**
 * Superagente LexisPredict: planejamento e regras determinísticas.
 * Não consulta banco, não envia mensagens e não presume que fontes foram lidas.
 * Inspirado nos gates de evidência do Lexis AI Suite e PredictLM.
 */
export type SuperAgentTask='atendimento'|'dossie'|'investigacao'|'relatorio'|'analise-processual'|'geral';

export function detectSuperAgentTask(raw:string):SuperAgentTask{
 const text=String(raw||'').toLocaleLowerCase('pt-BR');
 if(/(?:respond[aeiou]|responder|resposta\s+(?:ao|para)|mensagem\s+(?:ao|para)|whatsapp|cliente respondeu|falar com o cliente|enviar ao cliente|atender\s+(?:o|a|ao)\s+cliente)/i.test(text))
  return 'atendimento';
 if(/dossi[eê]|dossier|linha do tempo.*(caso|processo)|cronologia.*(prova|erro)/i.test(text))
  return 'dossie';
 if(/investiga[cç][aã]o|investig[au]|apurar|auditori[ao]|irregularidad|omiss[aã]o|erros? do advogado|den[uú]ncias?|ted\b|numoped\b/i.test(text))
  return 'investigacao';
 if(/relat[oó]rio|indicador|kpis?\b|produtividade|estat[ií]sticas|consolid[aá]d/i.test(text))
  return 'relatorio';
 if(/retorno\s+(?:ao|para)\s+(?:o\s+)?cliente|atendimento\s+(?:de|do|da)\s+[\p{L}]/iu.test(text))return 'atendimento';
 if(/processo|cnj|datajud|djen|tribunal|senten[cç]a|improced[eê]n|proced[eê]n|tr[aâ]nsito em julgado|cumprimento|recurso|movimenta[cç][aã]o/i.test(text))
  return 'analise-processual';
 return 'geral';
}

/** Incisividade extra apenas por pedido inequívoco do usuário na tarefa atual. */
export function requestedIncisiveMode(raw:string):boolean{
 return /\bmodo\s+agressivo\b|\bseja\s+agressiv[oa]\b|\btom\s+agressivo\b|\bmodo\s+incisivo\b|\bsem\s+papas\s+na\s+l[ií]ngua\b/i.test(String(raw||''));
}

export function extractCnjDigits(raw:string):string|null{
 const match=String(raw||'').match(/\b\d{7}[-.\s]?\d{2}[-.\s]?\d{4}[-.\s]?\d[-.\s]?\d{2}[-.\s]?\d{4}\b/);
 if(match)return match[0].replace(/\D/g,'');
 const digitsOnly=String(raw||'').trim();
 return /^\d{20}$/.test(digitsOnly)?digitsOnly:null;
}

/** Não transforma assuntos gerais em buscas de pessoas. */
export function extractCaseSearch(raw:string):string|null{
 const cnj=extractCnjDigits(raw);
 if(cnj)return cnj;
 // Busca apenas quando a tarefa liga explicitamente um nome a um processo.
 const text=String(raw||'').trim().slice(0,500);
 const m=text.match(/\b(?:processo|caso|cliente|atendimento|atualiza[cç][aã]o|andamento|movimenta[cç][aã]o)\s+(?:d[ao]s?\s+|de\s+)?([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,4})/iu);
 if(!m)return null;
 const stop=new Set([
  'um','uma','todos','todas','algum','alguma','empresa','banco','cliente',
  'hoje','ontem','amanha','atual','exemplo','qualquer','quero','saber','tem',
  'está','esta','este','esse','essa','qual','quando','onde','porque','por',
  'pode','precisa','ja','já','foi','teve','recebeu','receber','encerrou',
  'encerrado','andamento','movimento','processo','com','para','sobre','no','na',
  'agora','em','precisamos','preciso','mostrar','mostre','faça','faca'
 ]);
 const tokens=m[1].trim().split(/\s+/).filter(Boolean);
 const name:string[]=[];
 for(const token of tokens){
  if(stop.has(token.toLocaleLowerCase('pt-BR')))break;
  name.push(token);
 }
 if(!name.length)return null;
 // "processo de empresa"/ "caso do banco" não é identidade de pessoa.
 if(stop.has(name[0].toLocaleLowerCase('pt-BR')))return null;
 return name.slice(0,4).join(' ').slice(0,95);
}

export function superAgentInstructions(prompt:string):string{
 const task=detectSuperAgentTask(prompt);
 const incisive=requestedIncisiveMode(prompt);
 const core=`
SUPERAGENTE JURÍDICO LEXISPREDICT | PERFIL DE TRABALHO
- Execute raciocínio operacional especializado por tarefas, não invente que ferramentas executaram ações.
- Antes de responder sobre um caso, procure o CNJ na carteira autorizada, contexto oficial DataJud/DJEN e evidências disponíveis.
- Não peça CNJ ao cliente: busque por nome/correspondências internas; se não houver identificação segura, envie apenas saudação e avise que irá conferir. Nunca invente andamento.
- Registros do CRM não substituem sentença, inteiro teor, movimentações atuais, intimações ou o diário oficial; discrimine claramente fontes e datas de consulta.
- Registre o que foi CONFIRMADO, o que é INDÍCIO, RELATO ou HIPÓTESE; para cada afirmação importante informe fonte, data ou lacuna.
- Diferencie: encerramento administrativo, trânsito em julgado, improcedência, procedência, cumprimento de sentença, consulta DJEN sem publicação e prazo realmente validado.
- Para fundamentação legal, exija número, ano, artigo, trecho rastreável e fonte oficial. A skill ctresb/leis recupera texto convertido, NÃO comprova vigência nem jurisprudência. Se falhar, não invente a redação.
- Seja específico: explique O QUE mudou, QUEM deve agir, CONSEQUÊNCIA real e PRÓXIMO PASSO concreto. Não repita clichês ('seguimos acompanhando', 'precisa ser atendido') nem promessas vazias.
- Não assuma ação de advogado, envio WhatsApp, pagamento, decisão judicial, confirmação de cliente, nem reclassificação processual que não esteja comprovada.
- Nunca forneça telefone de terceiros, direcione a canais externos, prometa ganho da causa ou afirme culpa criminal/disciplinares sem suporte documental.
- Respeite empresa e visibilidade do usuário. Se faltar evidência, exponha com precisão a limitação; não preencha com conhecimento genérico.
- Por padrão, redija com firmeza técnica, linguagem humana, direta, fácil para leigos e sem a linguagem artificial de chatbot.
- Use modelos/agentes apenas para analisar; qualquer envio real, alteração de cadastro ou acusação pública depende de autorização e fluxo validado.
- Revisão humana é obrigatória antes de enviar comunicado jurídico sensível, apresentar acusações públicas ou executar alterações no processo.
`;
 const taskRules:Record<SuperAgentTask,string>={
  atendimento:`ATENDIMENTO: produza mensagem pronta, de 2 a 5 frases, personalizada com nome e fato confirmado; evite falar como robô ou oferecer números/terceiros. Nunca peça ao cliente o número do processo. Se não identificar com segurança, apenas cumprimente e diga que vai conferir, sem resumo inventado. Não marcar contato como realizado sem envio confirmado.`,
  dossie:`DOSSIÊ: organize identificação CNJ e partes, linha do tempo com datas e links/trechos, quadro de evidências e contraprovas, atuação de cada escritório/advogado, falhas verificadas, riscos qualitativos, prejuízos, consequências processuais e providências possíveis. Não some alegações como erros provados. Linguagem didática, títulos úteis, não mencionar pacote ZIP.`,
  investigacao:`INVESTIGAÇÃO: trace hipóteses verificáveis, compare autos, movimentações, e-mails e comunicações autorizadas. Exija prova e autoria antes de atribuir falha. Separe infração em tese, problema operacional, indício e fato comprovado. Investigações oficiais não devem ser presumidas porque há reclamações.`,
  relatorio:`RELATÓRIO: declare escopo (empresa ou usuário), período e data da extração; calcule agregações sem duplicar CNJ ou contar testes como contatos; explique divergências dos KPIs, mostre causas e impacto em termos claros. Não inventar totais ou percentuais de chance.`,
  'analise-processual':`PROCESSO: distinga última movimentação judicial, andamento do cumprimento, prazo judicial e retorno operacional. Não deduza procedência da flag is_procedente=false; leia teor decisório quando houver. Cite datas e fonte; se não conferiu atualização no tribunal, deixe explícito.`,
  geral:`GERAL: identifique a intenção, escolha skills relevantes e responda sem extrapolar fontes disponíveis.`,
 };
 const mode=incisive
  ?`MODO INCISIVO SOLICITADO: análise interna com linguagem firme, cirúrgica e sem eufemismos. Nomeie omissões, contradições e consequências quando comprovadas. Não insultar pessoas nem apresentar suspeitas como crime comprovado. Para mensagens a clientes, preserve postura profissional.`
  :`MODO PADRÃO: direto, crítico e verificável. Não ativar agressividade ou ataques pessoais sem solicitação expressa.`;
 return core+"\n"+taskRules[task]+"\n"+mode;
}
