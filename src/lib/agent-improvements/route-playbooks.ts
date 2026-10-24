/**
 * Catálogo determinístico de oportunidades por rota — NÃO é execução automática.
 * Avaliação por módulo construída a partir das rotas src/app do LexisPredict.
 * Inspiração: msitarzewski/agency-agents + addyosmani/agent-skills.
 */
export type RoutePlaybook={
 id:string;
 title:string;
 description:string;
 routes:readonly string[];
 specialists:readonly string[];
 skill:string;
 proposed:string;
 evidence:string;
 apiOpportunity:string;
 requiresReview:boolean;
};

export const ROUTE_PLAYBOOKS:readonly RoutePlaybook[]=[
 {id:'painel',title:'Dashboard e produtividade',routes:['/','/dashboard','/analytics','/insights','/estatistica-cnj','/ops','/premios'],
  description:'Métricas, produtividade e alertas operacionais.',specialists:['Analista de dados','Auditor de métricas','Revisor de UX'],
  skill:'analytics-and-evidence',proposed:'Conferir janela temporal, filtros, deduplicação e origem de cada KPI, com orçamento de processamento pequeno.',
  evidence:'Definição da métrica, período, contagem observada e fonte de dados.',apiOpportunity:'Baixa: preferir consultas Supabase autorizadas e métricas derivadas.',requiresReview:false},
 {id:'processos',title:'Processos e carteira',routes:['/cases','/processos','/clients','/consulta-bases','/revisional','/juridico','/encerrados-revisao','/cumprimentos-procedentes','/processos-parados','/busca-apreensao','/veredito','/gerador-processos','/urgency','/etica-operacional'],
  description:'Conferência processual, classificação de mérito e movimentação.',specialists:['Pesquisador jurídico','Analista de evidências','Revisor de cumprimento'],
  skill:'source-driven-development',proposed:'Verificação DataJud/DJEN com fonte e data, separando situação cadastral, mérito e fase de cumprimento.',
  evidence:'CNJ, fonte oficial, ato, data e lacunas registradas.',apiOpportunity:'Alta: documentar contratos e mudanças das integrações já autorizadas (DataJud/DJEN), sem capturar tokens.',requiresReview:true},
 {id:'provas',title:'Réplica, provas e dossiês',routes:['/fases-provas','/dossies','/analises-internas','/investigacao-predatoria','/tools/auditoria-contrato','/habilitacao-peca','/documents/investigacao'],
  description:'Qualidade da argumentação, documentos e cadeia de evidências.',specialists:['Editor de dossiê','Crítico jurídico','Auditor documental'],
  skill:'dossier-evidence-gate',proposed:'Cronologia com prova/contraprova, análise de erro comprovado versus indício, resumo técnico e controle de citações.',
  evidence:'Documento, trecho, data, responsável e nível de certeza.',apiOpportunity:'Média: inspeção de integrações oficiais de documentos apenas quando houver endpoint contratado.',requiresReview:true},
 {id:'comunicacoes',title:'WhatsApp e mensagens',routes:['/whatsapp','/mensagens','/notificacoes','/crm/followups'],
  description:'Comunicação correta, personalizada e comprovada.',specialists:['Redator de atendimento','Verificador de identidade','Guardião de consentimento'],
  skill:'whatsapp-browser',proposed:'Rascunho por último fato confirmado, checagem de duplicidade e opt-out; envio Web manual ou canal com comprovante.',
  evidence:'Cliente/CNJ autorizado, canal, texto aprovado e confirmação real.',apiOpportunity:'Média: monitorar contrato do worker próprio WA.Auto; não realizar reverse engineering de WhatsApp Web.',requiresReview:true},
 {id:'operacao',title:'Tarefas, prazos e agenda',routes:['/tarefas','/vencidos','/agenda','/minhas-atividades','/automacao-judicial'],
  description:'Alertas, prazos, devolutivas e fila de trabalho.',specialists:['Planejador de operações','Auditor de prazos','Testador de sincronização'],
  skill:'incremental-implementation',proposed:'Alertas consistentes entre Processos, Tarefas e Vencidos; auditar datas, revalidação e responsáveis.',
  evidence:'Data base, responsável, último retorno, próximo retorno e mudança auditável.',apiOpportunity:'Média: inventariar fluxos e respostas dos endpoints próprios, medindo latência.',requiresReview:true},
 {id:'relatorios',title:'Relatórios, PDF e indicadores',routes:['/report','/report/completo','/auditoria','/supervisao','/crm/atividades','/crm/financeiro','/financas'],
  description:'Visão executiva, dados consistentes e PDF utilizável.',specialists:['Analista de BI','Arquiteto de PDF','Revisor de acessibilidade'],
  skill:'performance-and-pdf',proposed:'Fonte única para tela/PDF, exportação funcional, contraste correto, otimização de grandes carteiras.',
  evidence:'Mesmo filtro e números na tela e no PDF; teste de impressão e extração textual.',apiOpportunity:'Alta nos endpoints internos de report para encontrar N+1, erros, payloads excessivos e 429/5xx.',requiresReview:false},
 {id:'crm',title:'CRM, vendas e relacionamentos',routes:['/crm','/crm/agentes','/crm/contatos','/crm/funil','/deals','/people','/crm/servicos','/crm/fornecedores','/companies','/companies/[id]'],
  description:'Contatos, oportunidades, propostas e agentes comerciais.',specialists:['Especialista em CRM','Revisor de dados','Analista de funil'],
  skill:'business-workflows',proposed:'Sugestões auditáveis sem dados inventados, enriquecimento de CNPJ por fonte pública e revisão humana.',
  evidence:'Último evento real, contato autorizado e fonte da classificação.',apiOpportunity:'Média: BrasilAPI e integrações comerciais documentadas; respeitar limite e consentimento.',requiresReview:true},
 {id:'financeiro',title:'Cobrança e conciliação',routes:['/crm/cobranca','/crm/a-receber','/crm/conciliacao','/crm/extrato','/planos','/calculos'],
  description:'Contratos, valores, conciliação e assinatura.',specialists:['Auditor financeiro','Revisor de contratos','Engenheiro de pagamentos'],
  skill:'contract-first-api',proposed:'Regras de idempotência e confirmação, conciliação por origem e revisão de efeitos de renovação.',
  evidence:'Transação, referência, origem e status verificado; nunca presumir pagamento.',apiOpportunity:'Alta para contratos dos gateways que sejam oficiais e autorizados; não reutilizar sessões bancárias capturadas.',requiresReview:true},
 {id:'agentes',title:'Superagente, chat e AI Lab',routes:['/chat','/superagente','/chat-ia','/chatbot-separado','/ai-lab','/ia-sync','/autoaprimoramento','/plugins','/modelos'],
  description:'Orquestração de agentes, pesquisa e inferência híbrida.',specialists:['Arquiteto multiagente','Avaliador de respostas','Especialista em performance'],
  skill:'agent-quality-gates',proposed:'Router determinístico, limites de contexto, evidência rastreável, avaliações e fallback seguro sem Qwen CPU.',
  evidence:'Entrada, fontes, critério de qualidade e resultado por ferramenta.',apiOpportunity:'Alta para observar contratos de IA própria e endpoints de ferramentas; sem capturar prompts privados.',requiresReview:true},
 {id:'documentos',title:'Documentos e peças',routes:['/documents','/documents/generator','/substabelecimento','/substabelecimento-peca','/substabelecimento-simples','/revogacao-poderes','/db-csv','/visualizador-csv','/visualizador-db','/import','/setup-planilha'],
  description:'Geração documental e importação estruturada.',specialists:['Revisor jurídico','Validador de esquema','Arquiteto de documento'],
  skill:'document-qa',proposed:'Validar partes, advogados e assinatura, deduplicar dados e preservar versão/contrato.',
  evidence:'Campos comparados à origem, autoria, versão e documento final revisado.',apiOpportunity:'Média: documentar integração de arquivos próprios; não converter dados bancários em clientes de APIs privadas.',requiresReview:true},
 {id:'gestao',title:'Equipe, acesso e infraestrutura',routes:['/settings','/settings/ops','/team','/superadmin','/security','/modo-seguranca','/primeiro-acesso','/onboarding','/setup-empresa','/signup','/login','/companies','/plano-b','/offline','/desktop','/ops'],
  description:'Permissões, auditoria, segurança e configuração.',specialists:['Engenheiro de identidade','Revisor de privacidade','SRE'],
  skill:'security-and-hardening',proposed:'Checar escopo por empresa, RLS e permissões; medir falhas de infraestrutura sem expor segredos.',
  evidence:'Política de acesso, evento auditado e teste de não vazamento entre empresas.',apiOpportunity:'Alta para inventariar APIs internas autorizadas e verificar contratos sem armazenar credenciais.',requiresReview:true},
 {id:'investigacao',title:'Investigação e pesquisa',routes:['/investigacao-predatoria','/consulta-bases','/tools/navegador','/mapa-codigo','/auditoria','/estatistica-cnj'],
  description:'Fontes públicas, consistência e rastreabilidade.',specialists:['Pesquisador de fontes','Auditor de APIs','Revisor de risco'],
  skill:'api-observation',proposed:'Inspecionar HAR exportado de navegação autorizada, removendo cookies e tokens, e manter fontes primárias.',
  evidence:'Host/rota/método/status sem payload sensível e referência documental externa.',apiOpportunity:'Alta: analisar tráfego previamente capturado pelo operador em ambiente autorizado, sem reexecutar chamadas.',requiresReview:true},
 {id:'ferramentas',title:'Ferramentas e laboratórios',routes:['/integracoes','/tools/automacao','/tools/ocr','/world-lab','/efferd-demo','/vitrine-fx','/gerador-processos','/autoaprimoramento'],
  description:'Integrações auxiliares e experimentos.',specialists:['Arquiteto de APIs','Engenheiro de testes','Revisor de segurança'],
  skill:'api-and-interface-design',proposed:'Definir contratos antes de automatizar e classificar experimental x disponível.',
  evidence:'Endpoint, entrada/saída tipadas, autenticação aprovada, teste e plano de reversão.',apiOpportunity:'Alta em APIs do próprio Lexis; nenhuma engenharia reversa de serviços protegidos.',requiresReview:true},
];

export const ROUTE_INVENTORY=Array.from(new Set(ROUTE_PLAYBOOKS.flatMap(p=>p.routes)));

export function playbooksForRoute(path:string):RoutePlaybook[]{
 const route=String(path||'/').split('?')[0].replace(/\/+$/,'')||'/';
 return ROUTE_PLAYBOOKS.filter(p=>p.routes.some(s=>s===route ||
  (s.includes('[id]') && new RegExp('^'+s.replace(/\[id\]/g,'[^/]+')+'$').test(route))));
}

export function recommendAgentTeamForRoute(path:string){
 const chosen=playbooksForRoute(path);
 return {
  path,
  playbooks:chosen,
  specialists:Array.from(new Set(chosen.flatMap(p=>p.specialists))),
  checks:Array.from(new Set(chosen.map(p=>p.evidence))),
  readOnlyByDefault:true,
  modelRequired:false,
 };
}
