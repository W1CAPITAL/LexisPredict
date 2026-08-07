/**
 * SUBSTITUA a lógica de busca do veredito/page.tsx por este padrão.
 * Arquivo de referência — copie os imports e handlers para o page.tsx client.
 *
 * CRÍTICO: NÃO importar @/lib/datajud neste page client.
 */

/*
// === IMPORTS (client) ===
import {
  searchProcessesByCpfAction,
  searchProcessesByNomeAction,
  enrichProcessTimelineAction,
} from '@/app/actions/search-actions';
import { executarVereditoAI } from '@/ai/flows/veredito-ai-flow';
import { fetchRepoCases } from '@/app/actions/case-actions';
// REMOVER: import { searchDataJudByNome, searchDataJudByCpf, fetchDataJud } from '@/lib/datajud';

// === abrirProcesso (CNJ da lista ou digitado) ===
const abrirProcesso = async (numero: string) => {
  setCnj(numero);
  setListaResultados([]);
  setLoading(true);
  setResult(null);
  setApiError(null);
  try {
    // Timeline server-side (DataJud → fallback DJEN) — sem CORS
    const timeline = await enrichProcessTimelineAction(numero);
    const data = await executarVereditoAI({ cnj: numero, preferredModel: model }).catch(() => null);

    if (!timeline.success && (!data || (!data.success && !data.dataJudRaw))) {
      setApiError({
        engine: 'datajud+djen',
        message: timeline.message || data?.message || 'CNJ não localizado.',
      });
      toast({ title: 'Sem movimentos', description: timeline.message, variant: 'destructive' });
    } else {
      setResult({
        ...(data || { success: true, isDeterministic: true }),
        movimentos: timeline.movimentos,
        comunicacoes: timeline.comunicacoes,
        fonteMovimentos: timeline.fonte,
        avisoFontes: timeline.message,
      });
      toast({
        title: timeline.fonte === 'djen' ? 'Timeline via DJEN' : 'Consulta concluída',
        description: timeline.message,
      });
    }
  } catch (e: any) {
    setApiError({ engine: 'server', message: e?.message || 'Falha na consulta' });
  } finally {
    setLoading(false);
  }
};

// === handleSearch ===
const handleSearch = async (e?: React.FormEvent) => {
  e?.preventDefault();
  if (loading) return;
  setLoading(true);
  setResult(null);
  setListaResultados([]);
  setApiError(null);

  try {
    if (searchMode === 'cpf') {
      const digits = cpfQuery.replace(/\D/g, '');
      if (digits.length < 11) {
        toast({ title: 'CPF/CNPJ inválido', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const res = await searchProcessesByCpfAction(digits, filtroBA);
      const items = res.items || [];
      setListaResultados(items);
      if (items.length === 0) {
        setApiError({
          engine: 'datajud',
          message:
            res.error ||
            'Nenhum processo encontrado. A API pública DataJud muitas vezes não indexa CPF. Tente por NOME da parte ou pelo CNJ completo. Para busca e apreensão, use o filtro B.A. após listar por nome/CNJ.',
        });
        toast({
          title: 'Nenhum processo',
          description: 'Use nome ou CNJ — CPF pode não estar no índice público.',
          variant: 'destructive',
        });
      } else {
        toast({ title: `${items.length} processo(s)`, description: filtroBA ? 'Filtro B.A. ativo' : undefined });
      }
      setLoading(false);
      return;
    }

    if (searchMode === 'nome') {
      if (nomeQuery.trim().length < 5) {
        toast({ title: 'Nome curto', variant: 'destructive' });
        setLoading(false);
        return;
      }
      // SERVER ACTION — nunca searchDataJudByNome no client
      const res = await searchProcessesByNomeAction(nomeQuery.trim());
      let items = res.items || [];
      if (filtroBA) {
        items = items.filter(
          (x: any) =>
            x.isBuscaApreensao || /BUSCA\s*E?\s*APREENS/i.test(String(x.classe || ''))
        );
      }
      setListaResultados(items);
      if (items.length === 0) {
        setApiError({
          engine: 'datajud',
          message: res.error || 'Nenhum processo para este nome. Tente o CNJ.',
        });
      } else {
        toast({ title: `${items.length} processo(s)` });
      }
      setLoading(false);
      return;
    }

    // CNJ
    if (!cnj.trim()) {
      setLoading(false);
      return;
    }
    await abrirProcesso(cnj.trim());
  } catch (err: any) {
    setApiError({ engine: 'server', message: err?.message || 'Erro na busca' });
    toast({ title: 'Erro', variant: 'destructive' });
    setLoading(false);
  }
};

// Na lista de resultados, badge se B.A.:
// {item.isBuscaApreensao && <Badge>Busca e apreensão</Badge>}
*/
