/**
 * Governança de status inativos / baixas tribunal.
 */

export const STATUS_ENCERRADOS = [
  'ENCERRADO',
  'ARQUIVADO',
  'EXTINTO',
  'SUSPENSO',
  'IMOVEL',
  'IMÓVEL',
  'BAIXA DEFINITIVA',
  'ARQUIVAMENTO',
];

export function isAguardandoProtocoloTribunal(texto: string): boolean {
  const t = String(texto || '').toUpperCase();
  if (!t) return false;
  return (
    /AGUARD\.?\s*PROTOCOLO/.test(t) ||
    /PROTOCOLO\s*DO\s*TJ/.test(t) ||
    /AGUARD\.PROTOCOLODO/.test(t)
  );
}

function hasStrongEncerrado(s: string): boolean {
  const u = String(s || '').toUpperCase();
  if (!u) return false;
  if (/\bENCERRAD[OA]\b/.test(u) || u.includes('ENCERRADO') || u.includes('ENCERRADA')) return true;
  if (u.includes('ARQUIVADO') || u.includes('ARQUIVAMENTO')) return true;
  if (u.includes('EXTINTO') || u.includes('EXTINÇÃO') || u.includes('EXTINCAO')) return true;
  if (u.includes('SUSPENSO')) return true;
  if (u.includes('BAIXA DEFINITIVA')) return true;
  if (u.includes('IMOVEL') || u.includes('IMÓVEL')) return true;
  if (u.includes('FINALIZADO') || u.includes('FINALIZADA')) return true;
  return false;
}

/** Teor de fim no tribunal (baixa / trânsito / arquivamento / extinção). */
export function textoBaixaOuArquivoTribunal(text: string): boolean {
  const t = String(text || '').toUpperCase();
  if (!t) return false;
  if (isAguardandoProtocoloTribunal(t) && !hasStrongEncerrado(t)) return false;
  return (
    /BAIXA\s+DEFINITIVA|BAIXA\s+DO\s+PROCESSO|BAIXA\s+PROVIS[OÓ]RIA|BAIXADO/.test(t) ||
    /ARQUIVAMENTO(\s+DEFINITIVO)?|ARQUIVADO\s+DEFINITIVAMENTE|ARQUIVADO\s+NO\s+TRIBUNAL/.test(t) ||
    /TR[AÂ]NSITO\s+EM\s+JULGADO|TRANSITO\s+EM\s+JULGADO/.test(t) ||
    /EXTIN[CÇ][AÃ]O\s+DO\s+PROCESSO|PROCESSO\s+EXTINTO|EXTINTO\s+SEM\s+RESOLU/.test(t) ||
    /ENCERRADO\s+NO\s+TRIBUNAL|ENCERRAMENTO\s+DO\s+PROCESSO/.test(t) ||
    /CANCELAMENTO\s+DA\s+DISTRIBUI[CÇ][AÃ]O|DESER[CÇ][AÃ]O/.test(t) ||
    /SENTEN[CÇ]A\s+DE\s+EXTIN|HOMOLOGA[CÇ][AÃ]O\s+DE\s+DESIST/.test(t)
  );
}

export function isCasoEncerrado(c: any): boolean {
  if (!c) return false;
  const d = c.dados && typeof c.dados === 'object' ? c.dados : {};

  if (c.via_scan_auto_encerrar || d.via_scan_auto_encerrar) return true;
  if (
    c.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR' ||
    d.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR'
  ) {
    return true;
  }

  const situ = String(
    c.situacao || d.situacao || c.status_interno || d.status_interno || d.SITUACAO || ''
  ).toUpperCase();
  const manual = String(c.statusManual || d.statusManual || d.STATUS_MANUAL || '').toUpperCase();
  const status = String(c.status || d.status || '').toUpperCase();
  const blob = `${status} ${situ} ${manual} ${c.status_interno || ''} ${d.status_interno || ''}`.trim();

  if (hasStrongEncerrado(situ) || hasStrongEncerrado(manual)) return true;
  if (hasStrongEncerrado(String(c.status_interno || d.status_interno || ''))) return true;

  const prazoOnly = [
    'VENCIDO', 'É HOJE', 'E HOJE', 'ATENÇÃO', 'ATENCAO', 'NO PRAZO', 'SEM PRAZO',
    'CASO CRÍTICO', 'CASO CRITICO', 'AUTOMATICO', 'AUTOMÁTICO',
  ];
  if (hasStrongEncerrado(status) && !prazoOnly.includes(status)) return true;

  if (isAguardandoProtocoloTribunal(blob) && !hasStrongEncerrado(blob)) return false;

  return STATUS_ENCERRADOS.some((x) => blob.includes(x));
}

/**
 * Baixa / fim no TRIBUNAL (telemetria) — Dashboard "Baixas tribunal".
 * Inclui flag datajud + termos equivalentes no teor salvo.
 */
export function isBaixaTribunal(c: any): boolean {
  if (!c) return false;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};

  const blob = [
    c.status,
    c.situacao,
    c.evento_resumo,
    c.datajud_encerrado_motivo,
    c.datajud_ultimo_nome,
    c.djen_ultimo_resumo,
    c.procedente_motivo,
    dados.situacao,
    dados.evento_resumo,
    dados.datajud_encerrado_motivo,
    dados.datajud_ultimo_nome,
    dados.djen_ultimo_resumo,
    dados.procedente_motivo,
    dados.merito_resultado,
  ]
    .map((x) => String(x || ''))
    .join(' ')
    .toUpperCase();

  if (isAguardandoProtocoloTribunal(blob) && !hasStrongEncerrado(blob)) return false;

  const emCump = !!(
    c.em_cumprimento_sentenca ||
    c.cumprimento_ativo ||
    c.cumprimento_pendente_necessario ||
    dados.em_cumprimento_sentenca
  );

  if (c.datajud_encerrado_tribunal || dados.datajud_encerrado_tribunal) {
    // cumprimento ativo ainda no gabinete: não conta como "só baixa" no KPI
    if (emCump && !isCasoEncerrado(c)) return false;
    return true;
  }

  if (textoBaixaOuArquivoTribunal(blob)) {
    if (emCump && !isCasoEncerrado(c)) return false;
    return true;
  }

  return false;
}

/**
 * Candidato ao AUTO-ENCERRAR / scanner multi-motor:
 * mesma ideia do scanner DataJud+DJEN, mas só foca quem já tem sinal de
 * baixa / arquivado / encerrado no tribunal (flag OU teor salvo).
 */
export function isCandidatoAutoEncerrarTribunal(c: any): boolean {
  if (!c) return false;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};

  // Já auto-encerrado pelo scanner → não reprocessar
  if (c.via_scan_auto_encerrar || dados.via_scan_auto_encerrar) return false;
  if (
    c.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR' ||
    dados.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR'
  ) {
    return false;
  }

  if (c.datajud_encerrado_tribunal || dados.datajud_encerrado_tribunal) return true;

  const blob = [
    c.status,
    c.situacao,
    c.evento_resumo,
    c.datajud_encerrado_motivo,
    c.datajud_ultimo_nome,
    c.djen_ultimo_resumo,
    c.procedente_motivo,
    dados.situacao,
    dados.evento_resumo,
    dados.datajud_encerrado_motivo,
    dados.datajud_ultimo_nome,
    dados.djen_ultimo_resumo,
    dados.procedente_motivo,
    dados.merito_resultado,
  ]
    .map((x) => String(x || ''))
    .join(' ');

  return textoBaixaOuArquivoTribunal(blob);
}
