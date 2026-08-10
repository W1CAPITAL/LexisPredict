/**
 * Tradução operacional de andamento → linguagem leiga (1–2 frases).
 * Não inventa mérito. Reutiliza sinal de capa / textos do caso.
 * @copyright 2026 W1 / LexisPredict
 */
import type { LegalCase } from './case-logic';
import { getSinalCapa, type SinalCapa } from './sinal-capa';

export type AndamentoLeigo = {
  tituloLeigo: string;
  detalheLeigo: string;
  /** Atividades sugeridas a partir do sinal */
  atividadesSugeridas: AtividadeTipo[];
};

export type AtividadeTipo =
  | 'ligar_cliente'
  | 'conferir_guia'
  | 'protocolar'
  | 'aguardar_andamento'
  | 'orientar_audiencia'
  | 'validar_baixa'
  | 'outro';

const LABEL_ATIVIDADE: Record<AtividadeTipo, string> = {
  ligar_cliente: 'Ligar / retornar ao cliente',
  conferir_guia: 'Conferir guia de custas',
  protocolar: 'Protocolar petição / documento',
  aguardar_andamento: 'Aguardar próximo andamento',
  orientar_audiencia: 'Orientar sobre audiência',
  validar_baixa: 'Validar baixa/trânsito no tribunal',
  outro: 'Outra providência',
};

export function labelAtividade(t: AtividadeTipo): string {
  return LABEL_ATIVIDADE[t] || t;
}

function stripHtml(s: string): string {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte título técnico + detalhe em frase leiga.
 */
export function traduzirAndamento(
  input: LegalCase | SinalCapa | { titulo?: string; detalhe?: string; evento_tipo?: string | null }
): AndamentoLeigo {
  let titulo = '';
  let detalhe = '';
  let eventoTipo = '';
  let caseLike: Partial<LegalCase> | null = null;

  if (input && typeof input === 'object' && 'protocolo' in (input as any)) {
    caseLike = input as LegalCase;
    const sinal = getSinalCapa(input as LegalCase);
    titulo = sinal.titulo;
    detalhe = sinal.detalhe;
    eventoTipo = String((input as LegalCase).evento_tipo || '');
  } else if (input && typeof input === 'object' && 'titulo' in (input as any)) {
    titulo = String((input as any).titulo || '');
    detalhe = String((input as any).detalhe || '');
    eventoTipo = String((input as any).evento_tipo || '');
  }

  const U = `${titulo} ${detalhe} ${eventoTipo}`.toUpperCase();
  const det = stripHtml(detalhe).slice(0, 180);

  let tituloLeigo = 'Atualização no processo';
  let detalheLeigo =
    det ||
    'Há movimentação registrada. Nossa equipe confere o teor completo antes de qualquer orientação definitiva.';
  const atividades: AtividadeTipo[] = [];

  if (/BUSCA|APREENS/.test(U) || (caseLike as any)?.indicio_busca_apreensao) {
    tituloLeigo = 'Movimentação sensível (possível medida restritiva)';
    detalheLeigo =
      'Apareceu indício de medida sensível nos registros. Confirmamos se diz respeito a este processo antes de qualquer alerta ao cliente.';
    atividades.push('ligar_cliente', 'aguardar_andamento');
  } else if (/AUDI[EÊ]NCIA/.test(U) || eventoTipo.startsWith('audiencia')) {
    tituloLeigo = 'Audiência marcada';
    detalheLeigo =
      det ||
      'Há indício de audiência designada. Confirmamos data e local nos autos e orientamos o cliente com antecedência.';
    atividades.push('orientar_audiencia', 'ligar_cliente');
  } else if (/CUSTAS|GUIA|PREPARO|UFESP|TAXA JUDICI/.test(U) || (caseLike as any)?.tem_custas) {
    tituloLeigo = 'Taxa ou custas no tribunal';
    detalheLeigo =
      det ||
      'Saiu movimentação ligada a custas/guia. Verificamos se há valor a pagar e de quem é a responsabilidade, para não gerar cobrança indevida.';
    atividades.push('conferir_guia', 'ligar_cliente');
  } else if (/IMPROCEDENTE/.test(U) || eventoTipo === 'sentenca_improcedente') {
    tituloLeigo = 'Decisão desfavorável (a confirmar nos autos)';
    detalheLeigo =
      det ||
      'Há registro de decisão desfavorável. Validamos o teor completo e eventuais próximos passos antes de informar o cliente com segurança.';
    atividades.push('validar_baixa', 'ligar_cliente');
  } else if (/PROCEDENTE/.test(U) && !/IMPROCEDENTE/.test(U)) {
    tituloLeigo = 'Decisão favorável (a confirmar nos autos)';
    detalheLeigo =
      det ||
      'Há indício de decisão favorável. Confirmamos o que isso significa na prática (valores, cumprimento, prazos) antes de qualquer expectativa.';
    atividades.push('validar_baixa', 'ligar_cliente');
  } else if (/PARCIAL/.test(U) || eventoTipo === 'sentenca_parcial') {
    tituloLeigo = 'Decisão parcial';
    detalheLeigo =
      det ||
      'O tribunal indica resultado parcial. Explicamos ao cliente, em linguagem simples, o que foi acolhido e o que não foi.';
    atividades.push('ligar_cliente');
  } else if (
    /BAIXA|TR[AÂ]NSITO|ARQUIVAMENTO|EXTIN[CÇ]/.test(U) ||
    (caseLike as any)?.datajud_encerrado_tribunal
  ) {
    tituloLeigo = 'Processo em fase final no tribunal';
    detalheLeigo =
      det ||
      'Há baixa ou trânsito registrado. Confirmamos o desfecho exato e se restam custas ou providências antes de encerrar o acompanhamento.';
    atividades.push('validar_baixa', 'conferir_guia');
  } else if (/CUMPRIMENTO|EXECU[CÇ][AÃ]O|FASE EXECUTIVA/.test(U) || (caseLike as any)?.em_cumprimento_sentenca) {
    tituloLeigo = 'Fase de cumprimento da decisão';
    detalheLeigo =
      det ||
      'O processo avançou para cumprimento de sentença. Isso significa que a decisão já existe e agora se discute o cumprimento.';
    atividades.push('aguardar_andamento', 'ligar_cliente');
  } else if (/LIMINAR|TUTELA/.test(U)) {
    tituloLeigo = 'Decisão liminar / tutela';
    detalheLeigo =
      det ||
      'Há registro de liminar ou tutela. Verificamos o conteúdo e o que o cliente precisa saber de imediato.';
    atividades.push('ligar_cliente');
  } else if (/PUBLICA[CÇ][AÃ]O|DI[AÁ]RIO|DJEN|DISPONIBILIZA/.test(U)) {
    tituloLeigo = 'Publicação no diário oficial';
    detalheLeigo =
      det ||
      'Saiu publicação oficial. Lemos o teor e, se for algo que exija contato, retornamos com orientação clara.';
    atividades.push('aguardar_andamento');
  } else if (titulo) {
    tituloLeigo = titulo
      .replace(/BAIXA\s*\/\s*TR[AÂ]NSITO.*/i, 'Processo em fase final')
      .replace(/SENTEN[CÇ]A:\s*/i, 'Decisão: ')
      .replace(/FASE EXECUTIVA/i, 'Fase de cumprimento')
      .replace(/NOVIDADE RELEVANTE/i, 'Nova movimentação');
    detalheLeigo =
      det ||
      'Há movimentação nova. A equipe analisa o teor completo e só então orienta o próximo passo.';
    atividades.push('aguardar_andamento');
  }

  if (!atividades.length) atividades.push('aguardar_andamento');

  return {
    tituloLeigo,
    detalheLeigo,
    atividadesSugeridas: atividades.slice(0, 3),
  };
}

/** Atalho a partir do caso */
export function traduzirCaso(c: LegalCase): AndamentoLeigo {
  return traduzirAndamento(c);
}
