/**
 * @fileOverview Motor de Consulta Diário de Justiça Eletrônico Nacional (DJEN) v2.0
 * Consulta a API pública do PJe para localizar comunicações oficiais.
 * Implementa estratégia de retries (Mascarado/Dígitos) e Janela Temporal de 1 ano.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

export interface DjenComunicacao {
  id: number | string;
  hash?: string;
  data_disponibilizacao: string | null;
  siglaTribunal: string | null;
  tipoComunicacao: string | null;
  nomeOrgao: string | null;
  texto: string | null;
  numero_processo: string | null;
  meio: string | null;
  link: string | null;
  tipoDocumento: string | null;
  nomeClasse: string | null;
  destinatarios?: { nome?: string; polo?: string }[];
  advogados?: { nome?: string; numero_oab?: string; uf_oab?: string }[];
}

export interface DjenFetchResult {
  success: boolean;
  error?: string;
  isRateLimited?: boolean;
  count: number;
  items: DjenComunicacao[];
}

/**
 * Realiza o fetch na API pública do DJEN com estratégia de retries e janela de datas.
 */
export async function fetchDjenComunicacoes(
  protocolo: string, 
  opts?: { 
    siglaTribunal?: string; 
    meio?: 'D' | 'E' | null;
    dataInicio?: string;
    dataFim?: string;
  }
): Promise<DjenFetchResult> {
  const digits = protocolo.replace(/\D/g, '');
  if (digits.length !== 20) {
    return { success: false, error: "CNJ Inválido (requer 20 dígitos)", count: 0, items: [] };
  }

  const masked = `${digits.substring(0,7)}-${digits.substring(7,9)}.${digits.substring(9,13)}.${digits.substring(13,14)}.${digits.substring(14,16)}.${digits.substring(16,20)}`;
  
  // Janela de datas padrão (1 ano)
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  const lastYear = new Date();
  lastYear.setFullYear(now.getFullYear() - 1);
  const lastYearISO = lastYear.toISOString().split('T')[0];

  const dataFim = opts?.dataFim || todayISO;
  const dataInicio = opts?.dataInicio || lastYearISO;

  const apiBase = process.env.DJEN_API_BASE || "https://comunicaapi.pje.jus.br";
  
  // Lista de tentativas (Estratégia DJE Web)
  const configs = [
    { numeroProcesso: masked, dataInicio, dataFim }, // 1. Mascarado com Datas
    { numeroProcesso: digits, dataInicio, dataFim }, // 2. Dígitos com Datas
    { numeroProcesso: masked },                       // 3. Mascarado sem Datas
    { numeroProcesso: digits }                        // 4. Dígitos sem Datas
  ];

  let lastError = "";

  for (const config of configs) {
    try {
      const params = new URLSearchParams({
        itensPorPagina: '100',
        pagina: '1',
        ...config
      });

      // Sigla do Tribunal (Apenas se válida e fornecida)
      if (opts?.siglaTribunal && !/^outros$/i.test(opts.siglaTribunal)) {
        params.append('siglaTribunal', opts.siglaTribunal.toUpperCase());
      }
      if (opts?.meio) params.append('meio', opts.meio);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(`${apiBase}/api/v1/comunicacao?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; LexisPredict/2.0)'
        },
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        return { success: false, isRateLimited: true, error: "Rate limit DJEN — aguarde cerca de 1 minuto", count: 0, items: [] };
      }

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();
      const rawItems = Array.isArray(data.items) ? data.items : [];

      // Se encontrou algo ou é sucesso definitivo (mesmo vazio), retorna
      if (rawItems.length > 0 || config === configs[configs.length - 1]) {
        const mappedItems: DjenComunicacao[] = rawItems.map((item: any) => ({
          id: item.id || item.comunicacao_id,
          hash: item.hash,
          data_disponibilizacao: item.data_disponibilizacao || item.datadisponibilizacao || null,
          siglaTribunal: item.siglaTribunal || item.siglatribunal || null,
          tipoComunicacao: item.tipoComunicacao || item.tipocomunicacao || null,
          nomeOrgao: item.nomeOrgao || item.nomeorgao || null,
          texto: item.texto || null,
          numero_processo: item.numeroProcesso || item.numeroprocessocommascara || null,
          meio: item.meio || null,
          link: item.link || null,
          tipoDocumento: item.tipoDocumento || item.tipodocumento || null,
          nomeClasse: item.nomeClasse || item.nomeclasse || null,
          destinatarios: item.destinatarios || [],
          advogados: item.advogados || []
        }));

        return {
          success: true,
          count: data.count || mappedItems.length,
          items: mappedItems
        };
      }
    } catch (e: any) {
      lastError = e.name === 'AbortError' ? "Tempo esgotado no DJEN" : (e.message || "Falha na conexão");
    }
  }

  return { success: false, error: lastError || "Nenhum resultado localizado no DJEN", count: 0, items: [] };
}
