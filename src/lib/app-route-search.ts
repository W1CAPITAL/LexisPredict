/**
 * Dicionário único de capacidades para as buscas já existentes (Ctrl+K e navegação móvel).
 * Não cria abas, rotas nem permissões. Os destinos continuam sendo os módulos oficiais.
 */
import {cnjEstruturaPlausivel} from './cnj-higiene';

const ALIASES:Readonly<Record<string,string>>={
 '/cases':'cnj processo cliente carteira meus casos acompanhamento dados',
 '/processos':'cnj processos empresa carteira advogado buscar advogado',
 '/consulta-oab':'oab pje office pjeoffice certificado digital token a1 a3 vidaas vidass mac macos apple silicon pkcs11 consulta autos tribunal pesquisa por advogado',
 '/fases-provas':'prova provas evidencias réplica revisão análise de autos cronologia auditoria jurídica tese documento fonte',
 '/documents':'central documentos procuração substabelecimento contrato assinatura assinafy peças',
 '/documents/generator':'petição minuta procuração substabelecimento peças pdf rtf assinafy assinatura eletrônica preparar documento provas fundamentos revisão',
 '/documents/investigacao':'investigação documental análise de autos documentos',
 '/dossies':'dossiê cronologia evidências fatos processos prova auditoria',
 '/chat':'superagente inteligência artificial jurídica auditoria provas documentos fontes fundamentação ai',
 '/integracoes':'asaas cobrança financeiro google calendar agenda oauth assinafy assinatura eletrônica api integrações',
 '/agenda':'agenda retorno prazo calendário google calendar compromisso',
 '/crm':'crm clientes comercial funil relacionamento contrato proposta',
 '/crm/financeiro':'financeiro cobrança asaas recebíveis conciliação pagamentos',
 '/tarefas':'fila pendências retorno prioridade acompanhamento prazo',
 '/report':'relatório auditoria gerencial indicadores evidências',
 '/settings':'personalização oab certificados integrações permissões'
};

function normalize(text:string):string{
 return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
}

export function routeKeywords(href:string):string{
 const route=String(href||'/').split(/[?#]/,1)[0].replace(/\/+$/,'')||'/';
 return ALIASES[route]||'';
}

/** Todas as palavras precisam existir na rota, nome, descrição ou aliases. */
export function matchesAppRouteSearch(query:string,label:string,href:string,description=''):boolean{
 const tokens=normalize(query).split(/\s+/).filter(Boolean);
 if(!tokens.length)return true;
 const searchable=normalize([label,href,description,routeKeywords(href)].join(' '));
 return tokens.every(token=>searchable.includes(token));
}

/** Só oferece busca CNJ direta (nunca presume existência do processo). */
export function resolveQuickCnjSearch(raw:string,target:'/processos'|'/cases'='/processos'):string|null{
 const input=String(raw||'').trim();
 if(!/^(?:\d{20}|\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})$/.test(input))return null;
 const digits=input.replace(/\D/g,'');
 if(!cnjEstruturaPlausivel(digits).ok)return null;
 return target+'?search='+encodeURIComponent(digits);
}
