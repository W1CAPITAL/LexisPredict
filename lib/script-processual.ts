/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SCRIPTS PROCESSUAIS v1.0 - LÓGICA DE GABINETE
 */

import { parseISO, parse, isAfter, isValid, startOfDay } from 'date-fns';

export interface ScriptSuggestion {
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
}

export interface ScriptInput {
  clienteNome?: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  datajudUltimoNome?: string | null;
  datajudUltimoMovimento?: string | null;
  movimentos?: Array<{ nome?: string; complemento?: string; descricao?: string; dataHora?: string }>;
}

/**
 * Categorias e Palavras-Chave (Priority Order)
 */
const CATEGORIES = [
  { id: 'baixa', keywords: ['BAIXA DEFINITIVA', 'TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'ARQUIVADO DEFINITIVAMENTE', 'CANCELADA A DISTRIBUIÇÃO', 'EXTINÇÃO DO PROCESSO'] },
  { id: 'ba', keywords: ['BUSCA E APREENSÃO', 'BUSCA E APREENSAO', 'APREENSÃO DO VEÍCULO', 'LIMINAR DEFERIDA', 'REINTEGRAÇÃO DE POSSE'] },
  { id: 'cumprimento', keywords: ['CUMPRIMENTO DE SENTENÇA', 'EXECUÇÃO DE SENTENÇA', 'FASE DE CUMPRIMENTO', 'CUMPRIMENTO PROVISÓRIO'] },
  { id: 'sentenca', keywords: ['SENTENÇA', 'SENTENCA', 'PROCEDENTE', 'IMPROCEDENTE', 'JULGADO'] },
  { id: 'recurso', keywords: ['APELAÇÃO', 'RECURSO INOMINADO', 'AGRAVO', 'CONTRARRAZÕES'] },
  { id: 'conclusos', keywords: ['CONCLUSOS PARA DESPACHO', 'CONCLUSOS PARA DECISÃO', 'CONCLUSOS PARA SENTENÇA'] },
  { id: 'citacao', keywords: ['CITAÇÃO', 'MANDADO', 'EXPEDIÇÃO DE MANDADO', 'INTIMAÇÃO DO RÉU'] },
  { id: 'prazos', keywords: ['DECURSO DE PRAZO', 'DECORRIDO O PRAZO', 'MANIFESTAÇÃO'] },
  { id: 'juntada', keywords: ['JUNTADA DE PETIÇÃO', 'PETIÇÃO JUNTADA'] },
];

const ROUTINE_KEYWORDS = [
  'ATO ORDINATÓRIO', 'MERO EXPEDIENTE', 'CERTIDÃO', 'DISPONIBILIZAÇÃO', 
  'PUBLICAÇÃO', 'REMESSA', 'RECEBIMENTO', 'MOVIMENTAÇÃO NÃO IDENTIFICADA',
  'AUTOS NO CARTÓRIO', 'RECEBIDOS OS AUTOS'
];

export function gerarSugestoesScript(input: ScriptInput): ScriptSuggestion[] {
  const { clienteNome = 'Cliente', protocolo, ultimoRetorno, movimentos = [] } = input;
  const suggestions: ScriptSuggestion[] = [];

  // 1. Ordenar movimentos por data DESC
  const sortedMovs = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const lastMovName = (sortedMovs[0]?.nome || input.datajudUltimoNome || '').toUpperCase();
  const lastMovDate = sortedMovs[0]?.dataHora || input.datajudUltimoMovimento;

  // 2. Regra Especial: Desde o Último Retorno
  let todasSaoRotinaDesdeRetorno = false;
  if (ultimoRetorno && lastMovDate) {
    try {
      const dateRetorno = parse(ultimoRetorno, 'dd/MM/yyyy', new Date());
      if (isValid(dateRetorno)) {
        const movsApos = sortedMovs.filter(m => m.dataHora && isAfter(parseISO(m.dataHora), dateRetorno));
        if (movsApos.length > 0) {
          todasSaoRotinaDesdeRetorno = movsApos.every(m => 
            ROUTINE_KEYWORDS.some(kw => (m.nome || '').toUpperCase().includes(kw))
          );
        }
      }
    } catch (e) {}
  }

  // 3. Seleção de Categoria
  let categoriaAtiva = 'rotina';
  if (todasSaoRotinaDesdeRetorno) {
    categoriaAtiva = 'rotina_pos_retorno';
  } else {
    const found = CATEGORIES.find(cat => cat.keywords.some(kw => lastMovName.includes(kw)));
    if (found) categoriaAtiva = found.id;
  }

  // 4. Scripts por Categoria
  const scripts: Record<string, ScriptSuggestion[]> = {
    baixa: [{
      categoria: 'baixa',
      titulo: 'Processo Finalizado (Baixa)',
      texto: `Olá, [Nome]! Temos uma ótima notícia sobre o seu processo [CNJ]. O tribunal oficializou a Baixa Definitiva (Trânsito em Julgado). Isso significa que o caso foi encerrado no sistema judicial e não cabem mais recursos. Nossa equipe agora segue com os ritos internos de arquivamento.`,
      quandoUsar: 'Usar quando identificar Trânsito em Julgado ou Baixa Definitiva.'
    }],
    ba: [{
      categoria: 'ba',
      titulo: 'Alerta de Busca e Apreensão',
      texto: `URGENTE: Sr(a). [Nome], identificamos um novo andamento de Busca e Apreensão no seu processo [CNJ]. Nossa equipe jurídica já está em prontidão para as medidas de defesa. É fundamental que mantenha o veículo em local seguro e aguarde nossas orientações imediatas.`,
      quandoUsar: 'Prioridade Máxima. Usar ao detectar Mandado de Busca ou Liminar de Posse.'
    }],
    sentenca: [{
      categoria: 'sentenca',
      titulo: 'Sentença Prolatada',
      texto: `Olá, [Nome]! Informamos que o juiz proferiu a Sentença no seu processo [CNJ]. No momento, nosso setor jurídico está realizando a leitura técnica dos fundamentos da decisão para definir os próximos passos estratégicos. Entraremos em contato em breve com o parecer completo.`,
      quandoUsar: 'Usar quando houver Sentença ou Julgamento de mérito.'
    }],
    conclusos: [{
      categoria: 'conclusos',
      titulo: 'Aguardando Decisão (Conclusos)',
      texto: `Oi, [Nome]! O seu processo [CNJ] teve uma atualização técnica: ele foi enviado para a mesa do juiz (conclusos). Isso significa que o processo está na fila para que o magistrado profira uma decisão ou despacho. Estamos monitorando diariamente esse retorno.`,
      quandoUsar: 'Usar quando o andamento indicar "Conclusos para despacho/decisão".'
    }],
    rotina_pos_retorno: [{
      categoria: 'rotina',
      titulo: 'Manutenção de Monitoramento',
      texto: `Olá, [Nome]! Desde nossa última conversa em [Data], o seu processo [CNJ] teve apenas movimentações internas de cartório (atos ordinatórios). Não houve nenhuma decisão nova do juiz que mude o status atual. Seguimos em vigilância constante e qualquer novidade relevante avisaremos imediatamente!`,
      quandoUsar: 'Ideal para quando o cliente pergunta e só houve "burocracia" de cartório desde o último contato.'
    }],
    rotina: [{
      categoria: 'rotina',
      titulo: 'Andamento de Rotina',
      texto: `Olá, [Nome]! Houve um novo andamento técnico no seu processo [CNJ]. Trata-se de uma atualização de rotina do tribunal (movimentação de cartório). O processo segue seu curso normal e nossa equipe jurídica está acompanhando o fluxo.`,
      quandoUsar: 'Usar para andamentos genéricos (Certidões, Publicações, etc).'
    }]
  };

  const selected = scripts[categoriaAtiva] || scripts['rotina'];
  
  return selected.map(s => ({
    ...s,
    texto: s.texto
      .replace(/\[Nome\]/g, clienteNome)
      .replace(/\[CNJ\]/g, protocolo)
      .replace(/\[Data\]/g, ultimoRetorno || 'últimos dias')
  }));
}
