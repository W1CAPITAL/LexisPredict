export type LegalDocumentKind =
  | 'peticao-inicial'
  | 'peticao-generica'
  | 'procuracao'
  | 'substabelecimento-com-reserva'
  | 'substabelecimento-sem-reserva'
  | 'revogacao-mandato'
  | 'replica'
  | 'impugnacao'
  | 'impugnacao-cumprimento'
  | 'pugnacao'
  | 'declaracao-hipossuficiencia'
  | 'mle-tjsp'
  | 'notificacao-extrajudicial'
  | 'apelacao'
  | 'recurso-inominado'
  | 'embargos-declaracao'
  | 'cumprimento-sentenca';

export type LegalDocumentData = {
  juizo?: string;
  comarca?: string;
  processo?: string;
  autor?: string;
  reu?: string;
  clienteNome?: string;
  cpf?: string;
  rg?: string;
  nacionalidade?: string;
  estadoCivil?: string;
  profissao?: string;
  endereco?: string;
  email?: string;
  advogadoNome?: string;
  oab?: string;
  advogadoAnteriorNome?: string;
  oabAnterior?: string;
  advogadoNovoNome?: string;
  oabNovo?: string;
  tituloAcao?: string;
  fatos?: string;
  fundamentos?: string;
  pedidos?: string;
  decisao?: string;
  prazoOuIntimacao?: string;
  valorCausa?: string;
  cidade?: string;
  dataExtenso?: string;
  notificante?: string;
  notificado?: string;
  enderecoNotificado?: string;
  objetoNotificacao?: string;
  prazoNotificacao?: string;
  beneficiario?: string;
  cpfBeneficiario?: string;
  formaRecebimento?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoConta?: string;
  titularConta?: string;
  cpfTitularConta?: string;
  chavePix?: string;
  valorExecucao?: string;
  indiceCorrecao?: string;
  juros?: string;
  termoInicial?: string;
  termoFinal?: string;
  descontos?: string;
  memoriaCalculo?: string;
  observacoes?: string;
  specialPowers?: string[];
  permiteSubstabelecer?: boolean;
  clienteCienteSemReserva?: boolean;
  constituiNovoPatrono?: boolean;
  revisouPrazo?: boolean;
  dadosBancariosConferidos?: boolean;
};

export type LegalDocumentTemplate = {
  id: LegalDocumentKind;
  label: string;
  category: 'Petições' | 'Mandatos' | 'Recursos' | 'Execução' | 'Extrajudicial' | 'Formulários';
  description: string;
  legalBasis: string[];
  deadlineHint?: string;
};

export const SPECIAL_POWER_OPTIONS = [
  'receber citação',
  'confessar',
  'reconhecer a procedência do pedido',
  'transigir',
  'desistir',
  'renunciar ao direito sobre o qual se funda a ação',
  'receber',
  'dar quitação',
  'firmar compromisso',
  'assinar declaração de hipossuficiência econômica',
] as const;

export const LEGAL_DOCUMENT_TEMPLATES: LegalDocumentTemplate[] = [
  { id:'peticao-inicial', label:'Petição inicial', category:'Petições', description:'Estrutura-base com juízo, partes, fatos, direito, pedidos, provas e valor da causa.', legalBasis:['CPC, arts. 319 e 320'] },
  { id:'peticao-generica', label:'Petição / manifestação genérica', category:'Petições', description:'Peça intermediária livre para requerimentos, juntadas e esclarecimentos.', legalBasis:['Adequar ao ato processual e à intimação concreta'] },
  { id:'procuracao', label:'Procuração ad judicia', category:'Mandatos', description:'Procuração editável com seleção explícita de poderes especiais.', legalBasis:['CPC, art. 105'] },
  { id:'substabelecimento-com-reserva', label:'Substabelecimento com reserva', category:'Mandatos', description:'Mantém o substabelecente nos poderes e inclui novo advogado.', legalBasis:['Código de Ética e Disciplina da OAB, art. 26'] },
  { id:'substabelecimento-sem-reserva', label:'Substabelecimento sem reserva', category:'Mandatos', description:'Transfere os poderes sem reserva; exige confirmação de ciência do cliente.', legalBasis:['Código de Ética e Disciplina da OAB, art. 26, §1º'] },
  { id:'revogacao-mandato', label:'Revogação de mandato / poderes', category:'Mandatos', description:'Revoga o mandato anterior e permite constituir novo patrono no mesmo ato.', legalBasis:['CPC, art. 111'] },
  { id:'replica', label:'Réplica à contestação', category:'Petições', description:'Resposta a preliminares, fatos impeditivos/modificativos/extintivos e documentos da contestação.', legalBasis:['CPC, arts. 350 e 351'], deadlineHint:'O CPC prevê manifestação em 15 dias nas hipóteses dos arts. 350/351; valide a intimação do processo.' },
  { id:'impugnacao', label:'Impugnação / manifestação', category:'Petições', description:'Minuta flexível para impugnar documento, alegação, cálculo, prova ou requerimento.', legalBasis:['Definir fundamento conforme o objeto impugnado'] },
  { id:'impugnacao-cumprimento', label:'Impugnação ao cumprimento de sentença', category:'Execução', description:'Estrutura para as matérias do art. 525, inclusive excesso com valor correto e memória.', legalBasis:['CPC, art. 525'], deadlineHint:'O prazo legal decorre do art. 525 e do andamento concreto; valide a intimação e o termo inicial.' },
  { id:'pugnacao', label:'Pugnação / manifestação', category:'Petições', description:'Manifestação objetiva de concordância, oposição ou requerimento sobre questão específica.', legalBasis:['Adequar ao despacho/intimação e ao procedimento aplicável'] },
  { id:'declaracao-hipossuficiencia', label:'Declaração de hipossuficiência', category:'Mandatos', description:'Declaração econômica editável para pedido de gratuidade.', legalBasis:['CPC, arts. 98 e 99'] },
  { id:'mle-tjsp', label:'Formulário MLE — TJSP', category:'Formulários', description:'Minuta editável dos dados para Mandado de Levantamento Eletrônico.', legalBasis:['Formulário MLE oficial do TJSP'], deadlineHint:'Conferir sempre o formulário oficial vigente e os poderes para receber/dar quitação.' },
  { id:'notificacao-extrajudicial', label:'Notificação extrajudicial', category:'Extrajudicial', description:'Notificação com objeto, fatos, obrigação/pedido, prazo e comprovação de envio.', legalBasis:['Fundamentação material depende da relação jurídica concreta'] },
  { id:'apelacao', label:'Apelação', category:'Recursos', description:'Petição de interposição + razões de apelação.', legalBasis:['CPC, art. 1.009 e seguintes'], deadlineHint:'Valide cabimento, preparo, prazo e termo inicial no processo antes do protocolo.' },
  { id:'recurso-inominado', label:'Recurso Inominado — JEC', category:'Recursos', description:'Recurso próprio contra sentença no Juizado Especial Cível.', legalBasis:['Lei 9.099/1995, arts. 41 e 42'], deadlineHint:'A Lei 9.099/1995 prevê 10 dias da ciência da sentença e disciplina preparo; valide o caso concreto.' },
  { id:'embargos-declaracao', label:'Embargos de declaração', category:'Recursos', description:'Para obscuridade, contradição, omissão ou erro material.', legalBasis:['CPC, arts. 1.022 e 1.023'], deadlineHint:'O CPC prevê 5 dias; confirme o regime aplicável e a intimação.' },
  { id:'cumprimento-sentenca', label:'Instaurar cumprimento de sentença', category:'Execução', description:'Requerimento de cumprimento com demonstrativo discriminado e atualizado do crédito.', legalBasis:['CPC, arts. 513, 523 e 524'] },
];

const p = (value: unknown, label: string) => String(value || '').trim() || `[PREENCHER ${label.toUpperCase()}]`;
const optional = (value: unknown) => String(value || '').trim();
const heading = (d: LegalDocumentData) => p(d.juizo, 'juízo competente');
const parties = (d: LegalDocumentData) => `PROCESSO Nº: ${p(d.processo,'número do processo')}
AUTOR/REQUERENTE: ${p(d.autor || d.clienteNome,'autor/requerente')}
RÉU/REQUERIDO: ${p(d.reu,'réu/requerido')}`;
const signature = (d: LegalDocumentData, role='Advogado(a)') => `${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.

________________________________________
${p(d.advogadoNome || d.clienteNome,'assinante')}
${d.oab ? `OAB ${d.oab}` : role}`;
const bodyOrPlaceholder = (value: unknown, label: string) => optional(value) || `[DESCREVER ${label.toUpperCase()} COM BASE NOS AUTOS/DOCUMENTOS. NÃO INVENTAR FATOS.]`;

function qualificacao(d: LegalDocumentData) {
  return [
    p(d.clienteNome || d.autor,'nome'),
    optional(d.nacionalidade),
    optional(d.estadoCivil),
    optional(d.profissao),
    d.rg ? `RG nº ${d.rg}` : '',
    d.cpf ? `CPF nº ${d.cpf}` : '',
    d.endereco ? `residente e domiciliado(a) em ${d.endereco}` : '',
    d.email ? `e-mail ${d.email}` : '',
  ].filter(Boolean).join(', ');
}

function powersText(d: LegalDocumentData) {
  const specials = (d.specialPowers || []).filter(Boolean);
  const general = 'poderes para o foro em geral, com cláusula ad judicia, em qualquer juízo, instância ou tribunal, podendo praticar os atos processuais ordinários necessários à defesa dos interesses do(a) outorgante';
  const special = specials.length ? `; e, de forma expressa e específica, poderes para ${specials.join(', ')}` : '';
  const subst = d.permiteSubstabelecer ? '; podendo substabelecer, com ou sem reserva de poderes' : '';
  return general + special + subst + '.';
}

function warningsFor(kind: LegalDocumentKind, d: LegalDocumentData): string[] {
  const w: string[] = [];
  if (['replica','impugnacao','impugnacao-cumprimento','apelacao','recurso-inominado','embargos-declaracao','cumprimento-sentenca'].includes(kind) && !d.processo) w.push('Informe e confira o número do processo.');
  if (['apelacao','recurso-inominado','embargos-declaracao','replica','impugnacao-cumprimento'].includes(kind) && !d.revisouPrazo) w.push('Prazo/cabimento ainda não foram marcados como conferidos nos autos.');
  if (kind === 'substabelecimento-sem-reserva' && !d.clienteCienteSemReserva) w.push('Substabelecimento sem reserva: confirme o prévio e inequívoco conhecimento do cliente.');
  if (kind === 'revogacao-mandato' && !d.advogadoNovoNome) w.push('Revogação em processo: informe o novo patrono ou confira a regularização da representação conforme o CPC.');
  if (kind === 'procuracao' && !(d.specialPowers || []).length) w.push('Nenhum poder especial do art. 105 do CPC foi selecionado; atos excepcionais não devem ser presumidos.');
  if (kind === 'mle-tjsp' && !d.dadosBancariosConferidos) w.push('MLE: os dados bancários/PIX ainda não foram marcados como conferidos.');
  if (kind === 'mle-tjsp' && !d.beneficiario) w.push('MLE: informe o beneficiário/credor.');
  if (kind === 'cumprimento-sentenca' && !d.memoriaCalculo) w.push('Cumprimento: inclua demonstrativo discriminado e atualizado do crédito.');
  if (kind === 'impugnacao-cumprimento' && /excesso/i.test(String(d.fundamentos||'')) && !d.memoriaCalculo) w.push('Se alegar excesso de execução, informe o valor entendido como correto e o demonstrativo.');
  return w;
}

export function buildLegalDocument(kind: LegalDocumentKind, d: LegalDocumentData) {
  let title = LEGAL_DOCUMENT_TEMPLATES.find(x=>x.id===kind)?.label.toUpperCase() || 'PEÇA JURÍDICA';
  let text = '';

  switch (kind) {
    case 'peticao-inicial':
      text = `${heading(d)}

${p(d.autor || d.clienteNome,'autor')}, ${qualificacao(d)}, por seu advogado ${p(d.advogadoNome,'advogado')}, ${d.oab ? `OAB ${d.oab}, ` : ''}vem respeitosamente propor

${p(d.tituloAcao,'nome da ação')}

em face de ${p(d.reu,'réu/requerido')}, pelos fatos e fundamentos a seguir.

I. DOS FATOS

${bodyOrPlaceholder(d.fatos,'fatos relevantes em ordem cronológica')}

II. DO DIREITO

${bodyOrPlaceholder(d.fundamentos,'fundamentos jurídicos e relação com os fatos')}

III. DOS PEDIDOS

${bodyOrPlaceholder(d.pedidos,'pedidos certos, determinados e individualizados')}

IV. DAS PROVAS

Requer a produção das provas pertinentes e a juntada dos documentos indispensáveis, conforme o caso.

VALOR DA CAUSA: ${p(d.valorCausa,'valor da causa')}

Termos em que,
Pede deferimento.

${signature(d)}`;
      break;
    case 'peticao-generica':
      text = `${heading(d)}

${parties(d)}

${p(d.autor || d.clienteNome,'parte')}, já qualificado(a) nos autos, por seu advogado, vem respeitosamente apresentar

${p(d.tituloAcao || 'PETIÇÃO / MANIFESTAÇÃO','título da peça')}

pelos seguintes fundamentos:

${bodyOrPlaceholder(d.fatos,'objeto da manifestação e fatos')}

${bodyOrPlaceholder(d.fundamentos,'fundamentação')}

DOS REQUERIMENTOS

${bodyOrPlaceholder(d.pedidos,'requerimentos')}

Termos em que,
Pede deferimento.

${signature(d)}`;
      break;
    case 'procuracao':
      title = 'PROCURAÇÃO AD JUDICIA';
      text = `PROCURAÇÃO AD JUDICIA

OUTORGANTE: ${qualificacao(d)}.

OUTORGADO(A): ${p(d.advogadoNome,'advogado')}, ${d.oab ? `inscrito(a) na OAB ${d.oab}` : '[PREENCHER OAB]'}.

PODERES: ${powersText(d)}

OBJETO ESPECÍFICO: ${optional(d.tituloAcao) || 'Atuação judicial e extrajudicial nos interesses do(a) outorgante'}${d.processo ? `, inclusive no processo nº ${d.processo}` : ''}.

${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.

________________________________________
${p(d.clienteNome || d.autor,'outorgante')}
Outorgante`;
      break;
    case 'substabelecimento-com-reserva':
      text = `SUBSTABELECIMENTO COM RESERVA DE PODERES

Pelo presente instrumento, ${p(d.advogadoAnteriorNome || d.advogadoNome,'advogado substabelecente')}, ${d.oabAnterior || d.oab ? `OAB ${d.oabAnterior || d.oab}` : '[PREENCHER OAB DO SUBSTABELECENTE]'}, SUBSTABELECE, COM RESERVA DE IGUAIS PODERES, a ${p(d.advogadoNovoNome,'advogado substabelecido')}, ${d.oabNovo ? `OAB ${d.oabNovo}` : '[PREENCHER OAB DO SUBSTABELECIDO]'}, os poderes recebidos de ${p(d.clienteNome || d.autor,'cliente/outorgante')}${d.processo ? `, nos autos do processo nº ${d.processo}` : ''}.

O substabelecente permanece habilitado no mandato, sem prejuízo dos poderes ora compartilhados.

${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.

________________________________________
${p(d.advogadoAnteriorNome || d.advogadoNome,'substabelecente')}
${d.oabAnterior || d.oab ? `OAB ${d.oabAnterior || d.oab}` : ''}`;
      break;
    case 'substabelecimento-sem-reserva':
      text = `SUBSTABELECIMENTO SEM RESERVA DE PODERES

Pelo presente instrumento, ${p(d.advogadoAnteriorNome || d.advogadoNome,'advogado substabelecente')}, ${d.oabAnterior || d.oab ? `OAB ${d.oabAnterior || d.oab}` : '[PREENCHER OAB DO SUBSTABELECENTE]'}, SUBSTABELECE, SEM RESERVA DE PODERES, a ${p(d.advogadoNovoNome,'advogado substabelecido')}, ${d.oabNovo ? `OAB ${d.oabNovo}` : '[PREENCHER OAB DO SUBSTABELECIDO]'}, os poderes recebidos de ${p(d.clienteNome || d.autor,'cliente/outorgante')}${d.processo ? `, nos autos do processo nº ${d.processo}` : ''}.

DECLARAÇÃO DE CIÊNCIA: o substabelecimento sem reserva pressupõe o prévio e inequívoco conhecimento do cliente, cuja comprovação deve ser preservada.

${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.

________________________________________
${p(d.advogadoAnteriorNome || d.advogadoNome,'substabelecente')}
${d.oabAnterior || d.oab ? `OAB ${d.oabAnterior || d.oab}` : ''}`;
      break;
    case 'revogacao-mandato':
      text = `REVOGAÇÃO DE MANDATO E PODERES

REVOGANTE: ${qualificacao(d)}.

Pelo presente instrumento, o(a) REVOGANTE declara revogados, a partir da comunicação deste ato, os poderes anteriormente conferidos a ${p(d.advogadoAnteriorNome,'advogado anterior')}, ${d.oabAnterior ? `OAB ${d.oabAnterior}` : '[PREENCHER OAB]'}${d.processo ? `, relativamente ao processo nº ${d.processo}` : ''}.

NOVO PATRONO: no mesmo ato, constitui ${p(d.advogadoNovoNome,'novo advogado')}, ${d.oabNovo ? `OAB ${d.oabNovo}` : '[PREENCHER OAB]'}, para assumir o patrocínio da causa, mediante procuração própria a ser juntada aos autos.

Requer-se, quando aplicável, a atualização da representação processual e das futuras intimações.

${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.

________________________________________
${p(d.clienteNome || d.autor,'revogante')}
Revogante`;
      break;
    case 'replica':
      text = `${heading(d)}

${parties(d)}

${p(d.autor || d.clienteNome,'autor')}, já qualificado(a), vem apresentar RÉPLICA À CONTESTAÇÃO.

I. SÍNTESE DA DEFESA

${bodyOrPlaceholder(d.decisao,'teses, preliminares e documentos trazidos na contestação')}

II. DA IMPUGNAÇÃO ÀS PRELIMINARES E AOS FATOS ALEGADOS

${bodyOrPlaceholder(d.fatos,'resposta objetiva aos fatos impeditivos, modificativos ou extintivos')}

III. DO MÉRITO

${bodyOrPlaceholder(d.fundamentos,'fundamentos jurídicos e prova correspondente')}

IV. DOS PEDIDOS

${bodyOrPlaceholder(d.pedidos,'pedidos, provas e reiteração do pedido inicial')}

Termos em que,
Pede deferimento.

${signature(d)}`;
      break;
    case 'impugnacao':
    case 'pugnacao':
      title = kind === 'pugnacao' ? 'MANIFESTAÇÃO / PUGNAÇÃO' : 'IMPUGNAÇÃO';
      text = `${heading(d)}

${parties(d)}

${p(d.autor || d.clienteNome,'parte')}, já qualificado(a), vem apresentar ${title} quanto a ${p(d.tituloAcao,'objeto impugnado')}.

I. DO OBJETO

${bodyOrPlaceholder(d.fatos,'ato, documento, cálculo ou alegação objeto da manifestação')}

II. DAS RAZÕES

${bodyOrPlaceholder(d.fundamentos,'razões fáticas, jurídicas e probatórias')}

III. DOS REQUERIMENTOS

${bodyOrPlaceholder(d.pedidos,'providências requeridas')}

Termos em que,
Pede deferimento.

${signature(d)}`;
      break;
    case 'impugnacao-cumprimento':
      text = `${heading(d)}

${parties(d)}

${p(d.reu || d.clienteNome,'executado')}, já qualificado(a), vem apresentar IMPUGNAÇÃO AO CUMPRIMENTO DE SENTENÇA.

I. TEMPESTIVIDADE E DELIMITAÇÃO

INTIMAÇÃO / TERMO INICIAL INFORMADO: ${p(d.prazoOuIntimacao,'intimação ou termo inicial')}

II. FUNDAMENTOS DA IMPUGNAÇÃO

${bodyOrPlaceholder(d.fundamentos,'matérias do art. 525 do CPC efetivamente aplicáveis')}

III. EXCESSO DE EXECUÇÃO, SE ALEGADO

VALOR COBRADO: ${p(d.valorExecucao,'valor cobrado')}
VALOR ENTENDIDO COMO CORRETO: ${p(d.valorCausa,'valor correto')}
DEMONSTRATIVO: ${bodyOrPlaceholder(d.memoriaCalculo,'memória discriminada e atualizada')}

IV. PEDIDOS

${bodyOrPlaceholder(d.pedidos,'pedidos da impugnação')}

Termos em que,
Pede deferimento.

${signature(d)}`;
      break;
    case 'declaracao-hipossuficiencia':
      title = 'DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA';
      text = `DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA

Eu, ${qualificacao(d)}, DECLARO, para fins de requerimento de gratuidade da justiça, que não disponho de recursos suficientes para arcar com as custas, despesas processuais e honorários sem prejuízo do meu sustento e/ou de minha família, comprometendo-me a informar alteração relevante da situação econômica e a apresentar documentos quando exigidos.

A presente declaração deve ser apreciada em conjunto com os elementos do caso concreto e com eventual documentação comprobatória.

${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.

________________________________________
${p(d.clienteNome || d.autor,'declarante')}
Declarante`;
      break;
    case 'mle-tjsp':
      title = 'FORMULÁRIO MLE — MANDADO DE LEVANTAMENTO ELETRÔNICO';
      text = `FORMULÁRIO MLE — MANDADO DE LEVANTAMENTO ELETRÔNICO
MINUTA EDITÁVEL PARA CONFERÊNCIA — TJSP

Número do processo (padrão CNJ): ${p(d.processo,'processo')}
Nome do Credor / Beneficiário: ${p(d.beneficiario || d.clienteNome,'beneficiário')}
CPF/CNPJ do Credor / Beneficiário: ${p(d.cpfBeneficiario || d.cpf,'CPF/CNPJ do beneficiário')}

FORMA DE RECEBIMENTO: ${p(d.formaRecebimento,'forma de recebimento')}

Titular da conta destino: ${p(d.titularConta || d.beneficiario,'titular da conta')}
CPF/CNPJ do titular: ${p(d.cpfTitularConta || d.cpfBeneficiario,'CPF/CNPJ do titular')}
Banco: ${p(d.banco,'banco')}
Agência: ${p(d.agencia,'agência')}
Conta: ${p(d.conta,'conta')}
Tipo de conta: ${p(d.tipoConta,'tipo de conta')}
Chave PIX, se aplicável: ${p(d.chavePix,'chave PIX')}

Advogado(a), se aplicável: ${p(d.advogadoNome,'advogado')}
OAB: ${p(d.oab,'OAB')}

OBSERVAÇÕES:
${optional(d.observacoes) || '[CONFERIR TITULARIDADE, PODERES PARA RECEBER/DAR QUITAÇÃO E O FORMULÁRIO OFICIAL VIGENTE DO TJSP ANTES DO PROTOCOLO.]'}

${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.`;
      break;
    case 'notificacao-extrajudicial':
      text = `NOTIFICAÇÃO EXTRAJUDICIAL

NOTIFICANTE: ${p(d.notificante || d.clienteNome,'notificante')}
NOTIFICADO(A): ${p(d.notificado || d.reu,'notificado')}
ENDEREÇO DO NOTIFICADO: ${p(d.enderecoNotificado,'endereço do notificado')}
ASSUNTO: ${p(d.objetoNotificacao || d.tituloAcao,'objeto da notificação')}

Prezado(a) Senhor(a),

O(A) NOTIFICANTE comunica formalmente o seguinte:

${bodyOrPlaceholder(d.fatos,'fatos, datas, documentos e obrigação discutida')}

FUNDAMENTO / POSIÇÃO DO NOTIFICANTE

${bodyOrPlaceholder(d.fundamentos,'fundamento contratual ou legal, se houver')}

Diante disso, fica o(a) NOTIFICADO(A) instado(a) a:

${bodyOrPlaceholder(d.pedidos,'providência exigida ou solução proposta')}

PRAZO PARA RESPOSTA/CUMPRIMENTO: ${p(d.prazoNotificacao,'prazo')}

Esta notificação busca registrar a comunicação e oportunizar solução documentada, sem renúncia a direitos não expressamente renunciados.

${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.

________________________________________
${p(d.notificante || d.clienteNome,'notificante')}
Notificante`;
      break;
    case 'apelacao':
      text = `${heading(d)}

${parties(d)}

${p(d.autor || d.clienteNome,'apelante')}, já qualificado(a), inconformado(a) com a sentença, vem interpor RECURSO DE APELAÇÃO, requerendo seu recebimento e remessa ao Tribunal competente, observados os pressupostos de admissibilidade.

${p(d.cidade,'cidade')}, ${p(d.dataExtenso,'data')}.

${p(d.advogadoNome,'advogado')}
${d.oab ? `OAB ${d.oab}` : '[PREENCHER OAB]'}

RAZÕES DE APELAÇÃO

APELANTE: ${p(d.autor || d.clienteNome,'apelante')}
APELADO: ${p(d.reu,'apelado')}
PROCESSO: ${p(d.processo,'processo')}

I. TEMPESTIVIDADE / PREPARO

${bodyOrPlaceholder(d.prazoOuIntimacao,'data da intimação, contagem e preparo/gratuidade')}

II. SÍNTESE DA SENTENÇA

${bodyOrPlaceholder(d.decisao,'capítulos da sentença efetivamente impugnados')}

III. RAZÕES PARA REFORMA OU ANULAÇÃO

${bodyOrPlaceholder(d.fundamentos,'fundamentos recursais, prova e precedentes pertinentes')}

IV. PEDIDOS

${bodyOrPlaceholder(d.pedidos,'conhecimento e provimento, com resultado pretendido')}

Termos em que,
Pede deferimento.`;
      break;
    case 'recurso-inominado':
      text = `${heading(d)}

${parties(d)}

${p(d.autor || d.clienteNome,'recorrente')}, por seu advogado, vem interpor RECURSO INOMINADO contra a sentença, requerendo o regular processamento e remessa à Turma Recursal.

I. TEMPESTIVIDADE E PREPARO

${bodyOrPlaceholder(d.prazoOuIntimacao,'ciência da sentença, contagem e preparo ou gratuidade')}

II. SÍNTESE DA SENTENÇA

${bodyOrPlaceholder(d.decisao,'pontos da sentença recorridos')}

III. RAZÕES RECURSAIS

${bodyOrPlaceholder(d.fundamentos,'erro de fato/direito e fundamentos de reforma')}

IV. PEDIDOS

${bodyOrPlaceholder(d.pedidos,'conhecimento e provimento, indicando o resultado pretendido')}

${signature(d)}`;
      break;
    case 'embargos-declaracao':
      text = `${heading(d)}

${parties(d)}

${p(d.autor || d.clienteNome,'embargante')}, já qualificado(a), vem opor EMBARGOS DE DECLARAÇÃO.

I. TEMPESTIVIDADE

${bodyOrPlaceholder(d.prazoOuIntimacao,'intimação e contagem do prazo')}

II. VÍCIO DA DECISÃO

DECISÃO EMBARGADA:
${bodyOrPlaceholder(d.decisao,'trecho/questão da decisão')}

VÍCIO APONTADO:
${bodyOrPlaceholder(d.fundamentos,'obscuridade, contradição, omissão ou erro material')}

III. PEDIDOS

${bodyOrPlaceholder(d.pedidos,'saneamento do vício e eventual efeito modificativo, se juridicamente cabível')}

${signature(d)}`;
      break;
    case 'cumprimento-sentenca':
      text = `${heading(d)}

${parties(d)}

${p(d.autor || d.clienteNome,'exequente')}, já qualificado(a), vem requerer a INSTAURAÇÃO DO CUMPRIMENTO DE SENTENÇA.

I. TÍTULO EXECUTIVO JUDICIAL

${bodyOrPlaceholder(d.decisao,'sentença/acórdão, trânsito em julgado ou hipótese de cumprimento provisório')}

II. CRÉDITO ATUALIZADO

Valor principal / base: ${p(d.valorCausa,'valor principal')}
Índice de correção monetária: ${p(d.indiceCorrecao,'índice de correção')}
Juros e taxa: ${p(d.juros,'juros e taxa')}
Termo inicial: ${p(d.termoInicial,'termo inicial')}
Termo final / data-base: ${p(d.termoFinal,'termo final')}
Descontos obrigatórios: ${optional(d.descontos) || 'Nenhum informado'}
Valor atualizado requerido: ${p(d.valorExecucao,'valor atualizado')}

DEMONSTRATIVO DISCRIMINADO E ATUALIZADO:
${bodyOrPlaceholder(d.memoriaCalculo,'memória de cálculo nos termos do art. 524 do CPC')}

III. PEDIDOS

${bodyOrPlaceholder(d.pedidos,'intimação para pagamento e medidas executivas cabíveis conforme o título')}

Termos em que,
Pede deferimento.

${signature(d)}`;
      break;
  }

  return {
    title,
    text,
    warnings: warningsFor(kind,d),
    template: LEGAL_DOCUMENT_TEMPLATES.find(x=>x.id===kind)!,
  };
}
