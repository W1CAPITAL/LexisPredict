"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type PartePessoa,
  type AdvogadoEditavel,
  type BancaLocal,
  emptyCliente,
  emptyBanca,
  emptyAdvogado,
  loadBancaLocal,
  loadAdvogadosLocal,
  saveBancaLocal,
  saveAdvogadosLocal,
  mapearExtracaoParaCliente,
  mapearExtracaoParaAdvogado,
} from "@/lib/partes-editaveis";

/** Estado compartilhado da banca/cliente/advogados entre abas de peças. */
export function usePartesEditaveis() {
  const [banca, setBanca] = useState<BancaLocal>(emptyBanca);
  const [cliente, setCliente] = useState<PartePessoa>(emptyCliente);
  const [advogados, setAdvogados] = useState<AdvogadoEditavel[]>([emptyAdvogado()]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBanca(loadBancaLocal());
    const advs = loadAdvogadosLocal();
    if (advs.length) setAdvogados(advs);
    setReady(true);
  }, []);

  const persist = useCallback(() => {
    saveBancaLocal(banca);
    saveAdvogadosLocal(advogados);
  }, [banca, advogados]);

  const aplicarExtracao = useCallback((resultado: any) => {
    setCliente(mapearExtracaoParaCliente(resultado));
    const outs = resultado?.outorgados || resultado?.advogados || [];
    if (Array.isArray(outs) && outs.length) {
      setAdvogados(outs.map(mapearExtracaoParaAdvogado));
    }
  }, []);

  return {
    banca,
    setBanca,
    cliente,
    setCliente,
    advogados,
    setAdvogados,
    ready,
    persist,
    aplicarExtracao,
  };
}
