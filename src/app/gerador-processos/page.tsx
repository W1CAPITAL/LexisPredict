"use client";

import {
  isPublicacaoBuscaApreensao,
  isBaInicioProcesso,
  isSemAdvogadoNoTeor,
  isBaCriminalOuTrafico,
  queriesBaInicio,
  queriesBaVeiculo,
  queriesBaCriminal,
} from '@/lib/ba-djen-flags';
import { splitDjenDateRange, djenRetryDelay, waitForDjen } from '@/lib/djen-scan-control';
import { useAuth } from '@/components/auth/auth-provider';
import React, { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  djenBuscaTexto,
  cnjOficial,
  djenLink,
  type DjenItemRaw,
  extractTelefonePorContexto,
  extractEmailFromDjenText,
  dataPublicacaoNaJanela,
} from "@/lib/djen-client";
import { xlsxProcessosDjenReal } from "@/lib/xlsx-lista-cnj";
import { onlyDigits, normName } from "@/lib/enrich-local-base";
import {
  FILTROS_STATUS,
  FILTROS_MATERIA,
  filtrosDefaultStatus,
  filtrosDefaultMateria,
  passaFiltrosCombinados,
  matchMateria,
  textoTemCnpj,
  extractNomeCompletoFromDjen,
  formatCnjMasked,
  isSegredoOuSigilo,
  teorConsultavel,
  classificarSentenca,
  type FiltroStatusId,
  type FiltroMateriaId,
  type ProcessoDjenReal,
  type ScanLogLine,
} from "@/lib/revisional-tribunal-filtros";
import { Download, Loader2, Search, ExternalLink, Square } from "lucide-react";
import {
  analisarProcedenteSemCumprimento,
  queriesProcedenteSemCumprimento,
  rotuloIdade,
  isEsferaPenal,
} from "@/lib/procedente-sem-cumprimento";
import {
  extractCpfFromDjenText,
  formatCpfMasked,
  TRIBUNAIS_DJEN,
} from "@/lib/djen-cpf-extract";
import { extractVeiculoFromDjenText } from "@/lib/djen-veiculo-extract";


const isoHoje = () => new Date().toISOString().slice(0, 10);
const isoIni = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

function Chip({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={
        "min-h-11 text-xs rounded-lg border px-3 py-2 font-medium disabled:opacity-60 " +
        (on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 text-muted-foreground")
      }
    >
      {on ? "✓ " : ""}
      {label}
    </button>
  );
}

/** Queries textuais derivadas dos chips F1/F2 marcados. */
function queriesDosFiltros(
  status: FiltroStatusId[],
  materia: FiltroMateriaId[]
): string[] {
  const qs: string[] = [];
  if (status.includes("extinto_sem_merito"))
    qs.push("sem resolução do mérito", "art. 485");
  if (status.includes("extinto_com_merito")) qs.push("com resolução do mérito", "art. 487");
  if (status.includes("encerrado")) qs.push("arquivamento");
  if (status.includes("ativo")) qs.push("intime-se");
  if (status.includes("ativo")) qs.push("prosiga-se");
  for (const m of materia) {
    const f = FILTROS_MATERIA.find((x) => x.id === m);
    if (f?.djenQuery) qs.push(f.djenQuery);
  }
  if (status.includes("extinto_sem_merito") && materia.includes("acao_revisional")) {
    qs.unshift("485 revisional");
  }
  return [...new Set(qs)].slice(0, 10);
}

const agora = () => new Date().toISOString().slice(11, 19);
export default function GeradorProcessosPage() {
  const { profile } = useAuth();
  const exclusionKey = `lexis-generated-cnj-v2:${profile?.empresa_id || 'session'}:${profile?.auth_user_id || 'session'}`;
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => { abortRef.current?.abort(); }, []);
  const [alvo, setAlvo] = useState("60");
  const [tribunal, setTribunal] = useState("");
  const [dataInicio, setDataInicio] = useState(isoIni);
  const [dataFim, setDataFim] = useState(isoHoje);
  const [statusOn, setStatusOn] = useState<FiltroStatusId[]>(() => filtrosDefaultStatus());
  const [materiaOn, setMateriaOn] = useState<FiltroMateriaId[]>(() => {
    const d = filtrosDefaultMateria();
    return d.includes("busca_apreensao") ? d : [...d, "busca_apreensao"];
  });
  const [somenteBuscaApreensao, setSomenteBuscaApreensao] = useState(true);
  /** Só aceita publicação com CPF válido no teor DJEN (PJe MG etc.) */
  const [somenteComCpf, setSomenteComCpf] = useState(false);
  const [somenteComPlaca, setSomenteComPlaca] = useState(false);
  /** Flags opcionais B.A. (só valem com modo B.A. ligado) */
  const [baInicioProcesso, setBaInicioProcesso] = useState(false);
  const [baSemAdvogado, setBaSemAdvogado] = useState(false);
  /** Separado: B.A. criminal/tráfico — NÃO misturar com veículo */
  const [baModoCriminal, setBaModoCriminal] = useState(false);
  const [exibirTelefoneAutor, setExibirTelefoneAutor] = useState(true);
  const [cnpj, setCnpj] = useState("");
  const [lista, setLista] = useState<ProcessoDjenReal[]>([]);
  const [exigeTelefone, setExigeTelefone] = useState(false);
  /** Prioriza "julgo procedente" ao autor sem cumprimento + amostra ~4 anos parados */
  const [modoProcedenteSemCumprimento, setModoProcedenteSemCumprimento] = useState(false);
  const [priorizarParados4a, setPriorizarParados4a] = useState(true);
  const [logs, setLogs] = useState<ScanLogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState(false);
  const [enrichMode, setEnrichMode] = useState<"off" | "csv" | "db" | "detran-opfs">("off");
  const [enrichFile, setEnrichFile] = useState<File | null>(null);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [enrichStatus, setEnrichStatus] = useState("");
  const enrichWorkerRef = useRef<Worker | null>(null);
  const stopRef = useRef(false);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const pushLogs = (m: ScanLogLine[]) => setLogs((p) => [...p, ...m].slice(-600));
  const pushLog = (level: ScanLogLine["level"], text: string) =>
    pushLogs([{ ts: agora(), level, text }]);

  const iniciar = async () => {
    const target = Math.min(Math.max(parseInt(alvo, 10) || 60, 1), 500);
    if (!statusOn.length && !materiaOn.length && !somenteBuscaApreensao && !modoProcedenteSemCumprimento) {
      pushLog("err", "Marque F1 e/ou F2, ative Somente busca e apreensão, ou Procedente sem cumprimento");
      return;
    }
    let windows: ReturnType<typeof splitDjenDateRange>;
    try { windows = splitDjenDateRange(dataInicio, dataFim); }
    catch (error: any) { pushLog('err', error.message); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sleep = (ms: number) => waitForDjen(ms, controller.signal);
    stopRef.current = false;
    setBusy(true);
    setLista([]);
    setLogs([]);
    pushLog("info", `DJEN · Alvo ${target} · ${windows.length} intervalos · sem sigilo · ${tribunal} · ${dataInicio} até ${dataFim}`);
    pushLog("info", "Consulta DIRETA do seu navegador ao DJEN (Comunica PJe) — usa o IP da sua rede, não o do servidor.");
    if (somenteBuscaApreensao) {
      pushLog("info", "B.A.: classificação pela classe e pelo teor; veículo e criminal são separados.");
    }


    const by = new Map<string, ProcessoDjenReal>();
    const exclude = new Set<string>(lista.map(item => item.processo.replace(/\D/g, '')));
    try {
      const saved = JSON.parse(localStorage.getItem(exclusionKey) || '[]');
      if (Array.isArray(saved)) saved.filter(value => typeof value === 'string' && /^\d{20}$/.test(value)).forEach(value => exclude.add(value));
    } catch { /* O histórico local é opcional. */ }
    const cnpjDigits = cnpj.replace(/\D/g, "");
    const siglaRaw = tribunal.trim().toUpperCase();
    const sigla = !siglaRaw || siglaRaw === "TODOS" || siglaRaw === "ALL" ? undefined : siglaRaw;
    let queries: string[];
    let scanDataInicio = dataInicio;
    let scanDataFim = dataFim;

    if (modoProcedenteSemCumprimento && !somenteBuscaApreensao) {
      // Mesma lógica de F1/F2 (queriesDosFiltros) + queries de procedência.
      // Datas = formulário (DJEN costuma devolver 0 em janela ~2021–2022).
      const base = queriesDosFiltros(statusOn, materiaOn) || [];
      const qsProc = queriesProcedenteSemCumprimento();
      queries = [...qsProc, ...base.filter((q) => !qsProc.includes(q))];
      if (!queries.length) queries = qsProc;
      scanDataInicio = dataInicio;
      scanDataFim = dataFim;
      pushLog(
        "info",
        "Modo PROCEDENTE SEM CUMPRIMENTO: mesma busca F1/F2 + 'julgo procedente'. Datas do formulário. Filtro LOCAL: procedente ao autor e SEM cumprimento no teor."
      );
      if (priorizarParados4a) {
        pushLog(
          "warn",
          "Priorizar ~4 anos: o índice DJEN quase não retorna 2021–2022. Mantendo datas do formulário; marque publicações mais antigas quando o teor trouxer data. Para carteira já no Lexis use o scanner de cumprimento."
        );
      }
    } else if (somenteBuscaApreensao) {
      if (baModoCriminal) {
        queries = queriesBaCriminal();
        pushLog("info", `Modo B.A. CRIMINAL (separado) · tribunal=${sigla || "TODOS"}`);
      } else {
        queries = baInicioProcesso
          ? [...queriesBaInicio(), ...queriesBaVeiculo()]
          : queriesBaVeiculo();
        pushLog(
          "info",
          `Modo B.A. VEÍCULO/FIDUCIÁRIA · tribunal=${sigla || "TODOS"} · exclui criminal/tráfico` +
            (baInicioProcesso ? " · INÍCIO" : "") +
            (baSemAdvogado ? " · SEM ADVOGADO" : "")
        );
      }
    } else {
      queries = queriesDosFiltros(statusOn, materiaOn) || [];
    }
    queries = [...new Set(queries)];
    if (!queries.length) {
      pushLog("err", "Nenhuma query para buscar.");
      setBusy(false);
      return;
    }

    const add = (items: ProcessoDjenReal[]) => {
      let n = 0;
      for (const it of items) {
        const d = it.processo.replace(/\D/g, "");
        if (by.has(d) || exclude.has(d)) continue;
        by.set(d, it);
        exclude.add(d);
        n++;
        if (by.size >= target) break;
      }
      if (n) {
        setLista([...by.values()]);
        try { localStorage.setItem(exclusionKey, JSON.stringify([...exclude].slice(-20000))); } catch {}
      }
      return n;
    };

    try {
      outer: for (const window of windows) {
        scanDataInicio = window.inicio;
        scanDataFim = window.fim;
        for (const q of queries) {
        if (by.size >= target || stopRef.current) break;

        let pagina = 1;
        let paginasVazias = 0;
        const pageFingerprints = new Set<string>();

        while ( by.size < target && !stopRef.current) {
          pushLog("info", `DJEN · texto “${q}” · pág ${pagina} · ${scanDataInicio}→${scanDataFim}`);
          let res = await djenBuscaTexto({
            texto: q,
            dataInicio: scanDataInicio,
            dataFim: scanDataFim,
            pagina,
            itensPorPagina: 50,
            siglaTribunal: sigla,
            signal: controller.signal,
          });

          // 429 → espera crescente e repete a MESMA página (até 6x)
          let retries = 0;
          while (res.rateLimited && retries < 3 && !stopRef.current) {
            retries++;
            const waitMs = djenRetryDelay(retries - 1, res.retryAfter);
            if (waitMs > 60000) {
              pushLog('err', `DJEN pediu ${Math.ceil(waitMs / 1000)}s de espera. Consulta pausada; tente mais tarde.`);
              break outer;
            }
            const espera = Math.ceil(waitMs / 1000);
            pushLog("warn", `429 — espera ${espera}s e repete pág ${pagina}`);
            await sleep(espera * 1000);
            res = await djenBuscaTexto({
              texto: q,
              dataInicio: scanDataInicio,
              dataFim: scanDataFim,
              pagina,
              itensPorPagina: 50,
              siglaTribunal: sigla,
            signal: controller.signal,
            });
          }

          if (res.htmlBlocked || res.rateLimited) {
            pushLog("err", res.htmlBlocked ? "DJEN devolveu uma página de bloqueio. Consulta interrompida; tente mais tarde." : "DJEN continua limitando as consultas após três tentativas. Consulta interrompida.");
            break outer;
          }
          if (res.geoBlocked) {
            pushLog("err", "DJEN 403 para a sua rede — raro; tente novamente mais tarde.");
            break outer;
          }
          if (!res.ok) {
            pushLog("err", String(res.error || "falha na consulta"));
            break;
          }

          if (stopRef.current || controller.signal.aborted) break outer;
          const fingerprint = res.items.map(it => `${it.id || it.hash || cnjOficial(it)}:${it.data_disponibilizacao || ''}`).sort().join('|');
          if (fingerprint && pageFingerprints.has(fingerprint)) {
            pushLog('warn', `DJEN repetiu a página ${pagina}; avançando para a próxima consulta.`);
            break;
          }
          if (fingerprint) pageFingerprints.add(fingerprint);
          // ---- filtros F1/F2 (ou só busca e apreensão) e higiene, localmente ----
          const bruto = res.items.length;
          const rows: ProcessoDjenReal[] = [];
          let skipSigilo = 0,
            skipCnj = 0,
            skipDup = 0,
            skipTeor = 0,
            skipCnpj = 0,
            skipFiltro = 0,
            skipNome = 0,
            skipData = 0,
            skipCpf = 0,
            skipPlaca = 0,
            skipTelefone = 0;

          for (const it of res.items) {
            const blob = `${it.nomeClasse || ""} ${it.texto || ""}`;
            if (isSegredoOuSigilo(blob)) {
              skipSigilo++;
              continue;
            }
            if (somenteBuscaApreensao) {
              if (!isPublicacaoBuscaApreensao(it.nomeClasse, it.texto, { modoCriminal: baModoCriminal })) {
                skipFiltro++;
                continue;
              }
              if (!baModoCriminal && isBaCriminalOuTrafico(it.texto, it.nomeClasse)) {
                skipFiltro++;
                continue;
              }
              // "Início" é OPCIONAL e frouxo: só descarta se flag ligada E teor claramente de 2º grau/apelação
              if (!baModoCriminal && baInicioProcesso) {
                const cls = String(it.nomeClasse || "");
                if (/apela[cç][aã]o|agravo|embargos/i.test(cls)) {
                  skipFiltro++;
                  continue;
                }
                // não exige mais isBaInicioProcesso estrito (zerava tudo)
              }
              if (baSemAdvogado && !isSemAdvogadoNoTeor(it.texto)) {
                skipFiltro++;
                continue;
              }
            }
            const digits = cnjOficial(it); // SEMPRE o campo oficial da API
            if (!digits) {
              skipCnj++;
              continue;
            }
            if (exclude.has(digits) || rows.some(row => row.processo.replace(/\D/g, "") === digits)) {
              skipDup++;
              continue;
            }
            if (!dataPublicacaoNaJanela(it.data_disponibilizacao, scanDataInicio, scanDataFim)) {
              skipData++;
              continue;
            }
            if (!teorConsultavel(it.texto)) {
              skipTeor++;
              continue;
            }
            if (cnpjDigits && !textoTemCnpj(blob, cnpjDigits)) {
              skipCnpj++;
              continue;
            }
            // Filtros de situação e matéria, exceto quando somenteBA — vide bloq.
            if (!somenteBuscaApreensao && !modoProcedenteSemCumprimento) {
              const gate = passaFiltrosCombinados(blob, statusOn, materiaOn);
              if (!gate.ok) {
                skipFiltro++;
                continue;
              }
            } else if (somenteBuscaApreensao) {
              // Não executa filtro de status/materia; já filtrou só BA acima.
            }
            // modoProcedente: filtro é analisarProcedenteSemCumprimento abaixo

            if (modoProcedenteSemCumprimento && !somenteBuscaApreensao) {
              if (isEsferaPenal(blob)) {
                skipFiltro++;
                continue;
              }
              const an = analisarProcedenteSemCumprimento(blob);
              if (!an.elegivel) {
                skipFiltro++;
                continue;
              }
            }

            const cpfPub = extractCpfFromDjenText(it.texto);
            const veic = extractVeiculoFromDjenText(it.texto);
            if (somenteComCpf && !cpfPub) { skipCpf++; continue; }
            if (somenteComPlaca && !veic.placa) { skipPlaca++; continue; }
            const nome = extractNomeCompletoFromDjen({
              texto: it.texto,
              destinatarios: it.destinatarios?.map(d => ({ nome: d.nome || d.nomeDestinatario, polo: d.polo || d.tipoPolo })),
            });
            // Telefone/email do tribunal só se NÃO for enriquecer com base local
            const usarTelTribunal = enrichMode === "off" && (exibirTelefoneAutor || exigeTelefone);
            const telefoneAutor = usarTelTribunal ? extractTelefonePorContexto(it.texto, nome) : "";
            if (exigeTelefone && enrichMode === "off" && !telefoneAutor) { skipTelefone++; continue; }
            if (!nome) { skipNome++; continue; }
            const semAdv = isSemAdvogadoNoTeor(it.texto);
            const criminal = isPublicacaoBuscaApreensao(it.nomeClasse, it.texto, { modoCriminal: true });
            const veiculo = isPublicacaoBuscaApreensao(it.nomeClasse, it.texto);
            const tipoBa = criminal ? "criminal" : veiculo ? "veiculo" : "";
            const inicio = veiculo && isBaInicioProcesso(it.texto, it.nomeClasse, { dataInicio, dataFim });
            rows.push(toRow(it, digits, nome, telefoneAutor, statusOn, materiaOn, sigla, cpfPub, veic.placa, veic.renavam, {
              sem_advogado: semAdv ? "SIM" : "NAO",
              tipo_ba: tipoBa,
              ba_inicio: inicio ? "SIM" : "NAO",
              flags: [
                tipoBa === "criminal" ? "BA_CRIMINAL" : tipoBa === "veiculo" ? "BA_VEICULO" : "",
                semAdv ? "SEM_ADVOGADO" : "",
                inicio ? "INICIO_PROCESSO" : "",
                cpfPub ? "COM_CPF" : "",
                veic.placa ? "COM_PLACA" : "",
              ].filter(Boolean).join(" | "),
            }));
          }

          const added = add(rows);
          pushLog(
            added ? "ok" : "warn",
            `Pág ${pagina}: adicionados ${added}/${bruto} · filtro_F1F2:${skipFiltro} sem_nome:${skipNome} sigilo:${skipSigilo} teor:${skipTeor} dup:${skipDup} sem_num:${skipCnj} fora_data:${skipData} cnpj:${skipCnpj} sem_cpf:${skipCpf} sem_placa:${skipPlaca} sem_fone:${skipTelefone}`
          );

          if (added) pushLog("ok", `Progresso ${by.size}/${target} (+${added})`);

          if (bruto === 0) {
            paginasVazias++;
            if (paginasVazias >= 2) break;
          } else paginasVazias = 0;

          if (bruto < 50) break; // última página desta query
          pagina += 1;
          await sleep(1200); // ritmo de leitura — sem rajada
        }
        if (by.size >= target || stopRef.current) break outer;
        }
      }
    } catch (e: any) {
      pushLog(e?.name === 'AbortError' ? 'info' : 'err', e?.name === 'AbortError' ? 'Consulta interrompida. Os resultados já obtidos foram mantidos.' : `DJEN: ${e?.message || String(e)}`);
    }

    setLista([...by.values()]);
    pushLog(
      by.size ? "ok" : "warn",
      `Fim · ${by.size}/${target} · consulta direta navegador→DJEN (número oficial da API, sem CNJ de teor, sem filtro de carteira/nome na consulta)`
    );
    setBusy(false);
  };


  useEffect(() => {
    const w = new Worker(new URL("../../workers/enrich-local.worker.ts", import.meta.url), { type: "module" });
    enrichWorkerRef.current = w;
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "enrich-progress") {
        const pct = m.total ? Math.round((Number(m.loaded) / Number(m.total)) * 100) : 0;
        setEnrichProgress(Math.max(1, pct));
        if (m.matched != null) setEnrichStatus(`Varredura local… ${m.matched} match(es)`);
      }
      if (m.type === "error") {
        setEnrichStatus(m.message || "Erro no enriquecimento");
        setExp(false);
      }
    };
    return () => w.terminate();
  }, []);

  const baixar = async () => {
    if (!lista.length) return;
    setExp(true);
    setEnrichProgress(0);
    try {
      let out = lista.map((p) => ({ ...p }));
      if (enrichMode !== "off") {
        const queries = out.map((p) => ({ cpf: p.cpf || "", nome: p.nome_completo || "" }));
        const hits = await new Promise<Record<string, any>>((resolve, reject) => {
          const w = enrichWorkerRef.current;
          if (!w) return reject(new Error("Worker de enriquecimento indisponível"));
          const onMsg = (ev: MessageEvent) => {
            const m = ev.data;
            if (m.type === "enrich-progress") {
              const pct = m.total ? Math.round((Number(m.loaded) / Number(m.total)) * 100) : 0;
              setEnrichProgress(Math.max(1, pct));
            }
            if (m.type === "enrich-done") {
              w.removeEventListener("message", onMsg);
              resolve(m.hits || {});
            }
            if (m.type === "error") {
              w.removeEventListener("message", onMsg);
              reject(new Error(m.message || "Falha ao enriquecer"));
            }
          };
          w.addEventListener("message", onMsg);
          if (enrichMode === "csv") {
            const files = enrichFiles.length ? enrichFiles : (enrichFile ? [enrichFile] : []);
            if (!files.length) {
              w.removeEventListener("message", onMsg);
              reject(new Error("Selecione 1+ CSV (ou pasta com partes)"));
              return;
            }
            setEnrichStatus(`Cruzando ${files.length} CSV(s) no PC…`);
            w.postMessage({ type: "enrich-csv-multi", files, queries, mapping: {} });
          } else if (enrichMode === "db") {
            if (!enrichDbFile) {
              w.removeEventListener("message", onMsg);
              reject(new Error("Selecione o .db DETRAN nesta aba"));
              return;
            }
            setEnrichStatus("Cruzando .db no PC (sql.js)…");
            w.postMessage({
              type: "enrich-db-file",
              file: enrichDbFile,
              queries,
              table: "SPT_USERS",
              mapping: { cpf: "cpf", nome: "nome", telefone: "telefone" },
            });
          } else {
            setEnrichStatus("Cruzando com DETRAN (OPFS)…");
            w.postMessage({
              type: "enrich-detran-opfs",
              queries,
              table: "SPT_USERS",
              mapping: { cpf: "cpf", nome: "nome", telefone: "telefone" },
            });
          }
        });

        let n = 0;
        out = out.map((p) => {
          const d = onlyDigits(p.cpf);
          const keyC = d.length === 11 ? `cpf:${d}` : "";
          const keyN = `nome:${normName(p.nome_completo)}`;
          const hit = (keyC && hits[keyC]?.matched ? hits[keyC] : null) || (hits[keyN]?.matched ? hits[keyN] : null);
          if (!hit) {
            return {
              ...p,
              base_local_match: "",
              base_local_telefone: "",
              base_local_cpf: "",
              base_local_nome: "",
            } as any;
          }
          n++;
          // Telefone/email: preferir SEMPRE a base local no cruzamento (não o teor do tribunal)
          return {
            ...p,
            telefone: hit.telefone || "",
            email: hit.email || p.email || "",
            cpf: p.cpf || hit.cpf || "",
            base_local_match: hit.match_by === "cpf" ? "CPF" : "NOME",
            base_local_telefone: hit.telefone || "",
            base_local_cpf: hit.cpf || "",
            base_local_nome: hit.nome || "",
            enrich_fonte: "base_local_pc",
            telefone_fonte: hit.telefone ? "base_local_pc" : "",
          } as any;
        });
        setEnrichStatus(`Enriquecido: ${n}/${out.length} com match na base local`);
        pushLog("ok", `Base local: ${n} processo(s) com nome/CPF encontrado(s); demais em branco`);
      }

      const blob = await xlsxProcessosDjenReal(out as any);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `djen-processos-${out.length}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      pushLog("err", `XLSX: ${e?.message || e}`);
      setEnrichStatus(e?.message || "Erro");
    } finally {
      setExp(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col h-dvh overflow-y-auto">
        <div className="p-4 border-b space-y-3">
          <h1 className="text-xl font-black">Gerador de processos automáticos</h1>
          <p className="text-xs text-muted-foreground">
            Fonte <strong>DJEN</strong> (Comunica PJe): publicações reais, CNJ oficial da API.
            CPF, placa, RENAVAM, email e telefone vêm somente do teor público, quando disponíveis.
            Os filtros de presença só descartam publicações quando ativados.
          </p>
          <label className="flex items-center gap-2 text-[11px] font-semibold">
            <input
              disabled={busy}
              type="checkbox"
              checked={exigeTelefone}
              onChange={(e) => setExigeTelefone(e.target.checked)}
            />
            Exigir telefone no DJEN (desligado = gera mesmo sem telefone)
          </label>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
            <label className="flex items-start gap-2 text-[11px] font-semibold">
              <input
              disabled={busy}
                type="checkbox"
                className="mt-0.5"
                checked={modoProcedenteSemCumprimento}
                onChange={(e) => { setModoProcedenteSemCumprimento(e.target.checked); if (e.target.checked) setSomenteBuscaApreensao(false); }}
              />
              <span>
                <span className="text-emerald-700 dark:text-emerald-400 font-black uppercase tracking-wide">
                  Procedente sem cumprimento
                </span>
                <span className="block text-muted-foreground font-normal mt-0.5">
                  Busca teores com <strong>julgo procedente</strong> (pedido do autor) e{" "}
                  <strong>sem</strong> instauração de cumprimento de sentença. Mistura com amostragem
                  aleatória do fluxo normal.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[11px] font-semibold pl-5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={priorizarParados4a}
                disabled={busy || !modoProcedenteSemCumprimento}
                onChange={(e) => setPriorizarParados4a(e.target.checked)}
              />
              <span>
                Sinalizar risco ~<strong>4–5 anos</strong> (prescrição da execução) quando a data do teor for antiga
                — <strong>não</strong> troca a janela DJEN (evita 0 resultados)
              </span>
            </label>
          {modoProcedenteSemCumprimento && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 pl-5">
                Usa a <strong>mesma busca F1/F2</strong> (marque Procedente / Procedente em parte / revisional…) mais “julgo procedente”.
                O filtro extra é só no teor: procedente ao autor e <strong>sem</strong> cumprimento instaurado.
                Datas = campos do formulário (não força 2021–22 — o DJEN volta vazio nessa janela).
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-amber-600">
              Filtro 1 · Situação · {statusOn.length}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {FILTROS_STATUS.map((f) => (
                <Chip
                  disabled={busy}
                  key={f.id}
                  on={statusOn.includes(f.id as FiltroStatusId)}
                  label={f.nomeTribunal}
                  onClick={() =>
                    setStatusOn((p) =>
                      p.includes(f.id as FiltroStatusId)
                        ? p.filter((x) => x !== f.id)
                        : [...p, f.id as FiltroStatusId]
                    )
                  }
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-sky-600">
              Filtro 2 · Matéria · {materiaOn.length}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {FILTROS_MATERIA.map((f) => (
                <Chip
                  disabled={busy}
                  key={f.id}
                  on={materiaOn.includes(f.id as FiltroMateriaId)}
                  label={f.nomeTribunal}
                  onClick={() =>
                    setMateriaOn((p) =>
                      p.includes(f.id as FiltroMateriaId)
                        ? p.filter((x) => x !== f.id)
                        : [...p, f.id as FiltroMateriaId]
                    )
                  }
                />
              ))}
              <Chip
                  disabled={busy}
                onClick={() => {
                  if (!somenteBuscaApreensao) { setBaModoCriminal(false); setModoProcedenteSemCumprimento(false); }
                  setSomenteBuscaApreensao(!somenteBuscaApreensao);
                }}
                on={somenteBuscaApreensao}
                label="Somente busca e apreensão (fora da carteira)"
              />
              {somenteBuscaApreensao && (
                <>
                  <Chip
                  disabled={busy}
                    onClick={() => { setBaModoCriminal(false); }}
                    on={!baModoCriminal}
                    label="B.A. VEÍCULO (padrão — sem criminal)"
                  />
                  <Chip
                  disabled={busy}
                    onClick={() => { setBaModoCriminal(true); setBaInicioProcesso(false); }}
                    on={baModoCriminal}
                    label="B.A. CRIMINAL (opção separada)"
                  />
                  {!baModoCriminal && (
                    <Chip
                  disabled={busy}
                      onClick={() => setBaInicioProcesso((p) => !p)}
                      on={baInicioProcesso}
                      label="B.A. no início do processo"
                    />
                  )}
                  <Chip
                  disabled={busy}
                    onClick={() => setBaSemAdvogado((p) => !p)}
                    on={baSemAdvogado}
                    label="Sem advogado no teor"
                  />
                </>
              )}
              <Chip
                  disabled={busy}
                onClick={() => setSomenteComCpf((p) => !p)}
                on={somenteComCpf}
                label="Só com CPF no teor DJEN"
              />
              <Chip
                  disabled={busy}
                onClick={() => setSomenteComPlaca((p) => !p)}
                on={somenteComPlaca}
                label="Só com placa no teor DJEN"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Datas = janela da publicação DJEN. Com “início” ligado, o teor precisa anunciar um ato inicial de B.A.; menções históricas não bastam.
            “Sem advogado” indica somente ausência de inscrição no teor. Filtros F1/F2 não se aplicam ao modo B.A.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <Input disabled={busy} className="h-9 w-20" value={alvo} onChange={(e) => setAlvo(e.target.value)} title="Alvo" />
            <select disabled={busy} aria-label="Tribunal DJEN"
              className="h-9 min-w-[9rem] rounded-md border border-border bg-background px-2 text-[11px] font-semibold uppercase"
              value={tribunal}
              onChange={(e) => setTribunal(e.target.value)}
              title="Tribunal DJEN (vazio = todos)"
            >
              {TRIBUNAIS_DJEN.map((tj) => (
                <option key={tj.id || "all"} value={tj.id}>
                  {tj.label}
                </option>
              ))}
            </select>
            <Input disabled={busy} className="h-9 w-36" aria-label="Publicação: data inicial" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            <Input disabled={busy} className="h-9 w-36" aria-label="Publicação: data final" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            <Input disabled={busy} className="h-9 w-36 font-mono" placeholder="CNPJ opcional" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            {!busy ? (
              <Button onClick={iniciar} className="h-9 text-xs font-black uppercase gap-1">
                <Search className="w-4 h-4" /> Buscar
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="h-9 text-xs font-black uppercase"
                onClick={() => { stopRef.current = true; abortRef.current?.abort(); }}
              >
                <Square className="w-3 h-3" /> Parar
              </Button>
            )}
            
            <div className="rounded-xl border border-border/60 p-3 space-y-2 bg-card/40">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enriquecer XLSX com base local (sem Supabase)</p>
              <p className="text-[11px] text-muted-foreground">Cruza nome/CPF do DJEN com CSV ou DETRAN no seu PC. Match → preenche colunas; senão em branco. Não sobe arquivo para a nuvem.</p>
              <div className="flex flex-wrap gap-2 items-center">
                <select className="h-9 rounded-md border bg-background px-2 text-xs" value={enrichMode} onChange={(e) => setEnrichMode(e.target.value as any)}>
                  <option value="off">Sem cruzamento</option>
                  <option value="csv">CSV no PC (Credilink etc.)</option>
                  <option value="db">DETRAN .db no PC (esta aba)</option>
                  <option value="detran-opfs">DETRAN já no OPFS (Consulta bases)</option>
                </select>
                {enrichMode === "csv" && (
                  <div className="flex flex-col gap-1">
                    <input type="file" accept=".csv,text/csv" multiple className="text-xs" onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      setEnrichFiles(files);
                      setEnrichFile(files[0] || null);
                    }} />
                    <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <input type="file" className="text-xs" multiple /* @ts-expect-error webkitdirectory */ {...({ webkitdirectory: "", directory: "" } as any)} onChange={(e) => {
                        const files = e.target.files ? Array.from(e.target.files).filter((f) => /\.csv$/i.test(f.name)) : [];
                        setEnrichFiles(files);
                        setEnrichFile(files[0] || null);
                        setEnrichStatus(files.length ? `${files.length} CSV(s) da pasta` : "Nenhum CSV na pasta");
                      }} />
                      ou pasta com várias partes (ex.: 1351 CSVs)
                    </label>
                    {enrichFiles.length > 0 && <span className="text-[10px]">{enrichFiles.length} arquivo(s) pronto(s)</span>}
                  </div>
                )}
                {enrichMode === "db" && (
                  <input type="file" accept=".db,.sqlite,.sqlite3" className="text-xs" onChange={(e) => setEnrichDbFile(e.target.files?.[0] || null)} />
                )}
              </div>
              {(enrichProgress > 0 || enrichStatus) && (
                <p className="text-[11px] text-muted-foreground">{enrichStatus} {enrichProgress ? `· ${enrichProgress}%` : ""}</p>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={baixar}
              disabled={!lista.length || exp}
              className="h-9 text-xs font-black uppercase gap-1"
            >
              {exp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} XLSX
            </Button>
            <label className="flex items-center gap-2 text-[11px] cursor-pointer">
              <input
              disabled={busy}
                type="checkbox"
                checked={exibirTelefoneAutor || exigeTelefone}
                onChange={(e) => setExibirTelefoneAutor(e.target.checked)}
              />
              Achar telefone do autor quando disponível
            </label>
          </div>
          <p className="text-[11px] font-mono font-bold">
            {lista.length}/{alvo} {busy && <Loader2 className="w-3 h-3 inline animate-spin" />}
          </p>
        </div>
        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_minmax(280px,38%)] overflow-hidden">
          <div className="overflow-auto p-3 space-y-2">
            {lista.map((p) => {
              const blob = `${p.status_detectado} ${p.situacao_hint}`.toLowerCase();
              const extinto = blob.includes("extinto");
              const anProc = analisarProcedenteSemCumprimento(blob);
              const procedente = !extinto && anProc.isProcedenteAutor;
              const improcedente = !extinto && anProc.isImprocedente;
              const semCumpr = anProc.elegivel;
              const idadeLbl = rotuloIdade(p.data);
              const baClareadoLocal = p.ba_djen === true;
              return (
                <article key={p.processo} className="border rounded-xl p-3 space-y-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-sm font-bold">{p.processo}</p>
                        {baClareadoLocal && (
                          <span className="text-[10px] font-black uppercase rounded-full px-2 py-0.5 border bg-amber-500/15 text-amber-600 border-amber-500/40">
                            BUSCA E APREENSÃO
                          </span>
                        )}
                        <span
                          className={
                            "text-[10px] font-black uppercase rounded-full px-2 py-0.5 border " +
                            (extinto
                              ? "bg-red-500/15 text-red-500 border-red-500/40"
                              : procedente
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/40"
                                : improcedente
                                  ? "bg-amber-500/15 text-amber-600 border-amber-500/40"
                                  : "bg-muted text-muted-foreground border-border")
                          }
                        >
                          {extinto
                            ? "EXTINTO"
                            : semCumpr
                              ? anProc.label
                              : procedente
                                ? anProc.label
                                : improcedente
                                  ? "IMPROCEDENTE"
                                  : "NÃO CLASSIFICADO"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold">{p.nome_completo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.classe || "—"} · {p.situacao_hint} · {p.data}
                        {idadeLbl ? ` · ${idadeLbl}` : ""}
                      </p>
                      {semCumpr && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                          {anProc.motivo}
                        </p>
                      )}
                      {p.telefone && (
                        <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                          {p.telefone}
                        </p>
                      )}
                      {p.email && <p className="text-xs break-all">{p.email}</p>}
                      {p.cpf && (
                        <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
                          CPF {formatCpfMasked(p.cpf)}
                        </p>
                      )}
                      {(p.placa || p.renavam) && (
                        <p className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                          {p.placa ? `Placa ${p.placa}` : ""}{p.renavam ? ` · RENAVAM ${p.renavam}` : ""}
                        </p>
                      )}
                      {p.sem_advogado === "SIM" && (
                        <p className="inline-flex rounded-md border px-2 py-1 text-xs text-rose-700 dark:text-rose-300">
                          Sem advogado
                        </p>
                      )}
                      {p.tipo_ba && (
                        <p className="inline-flex rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                          B.A. {p.tipo_ba === "criminal" ? "criminal" : "veículo"}
                          {p.ba_inicio === "SIM" ? " · início" : ""}
                        </p>
                      )}
                    </div>
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-primary inline-flex gap-1 items-center"
                      >
                        <ExternalLink className="w-3 h-3" /> DJEN
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="border-l flex flex-col min-h-0 bg-[#0C0C0C] text-[#CCCCCC]">
            <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-[#6A9955] border-b border-[#222] shrink-0">
              C:\LEXIS\GERADOR&gt; log
            </div>
            <div className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-5">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === "err"
                      ? "text-[#F14C4C]"
                      : l.level === "warn"
                        ? "text-[#CCA700]"
                        : l.level === "ok"
                          ? "text-[#3FC56A]"
                          : "text-[#D4D4D4]"
                  }
                >
                  <span className="text-[#6A9955]">{l.ts ? `${l.ts} ` : ""}</span>
                  {l.text}
                </div>
              ))}
              <div ref={logEnd} className="text-[#3FC56A]">
                {busy ? "_" : ""}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ---------- row builder ----------

function toRow(
  it: DjenItemRaw,
  digits: string,
  nome: string,
  telefoneAutor: string,
  statusOn: FiltroStatusId[],
  materiaOn: FiltroMateriaId[],
  sigla?: string,
  cpfExtra?: string,
  placaExtra?: string,
  renavamExtra?: string,
  extra?: Pick<ProcessoDjenReal, "sem_advogado" | "tipo_ba" | "ba_inicio" | "flags">
): ProcessoDjenReal {
  const tel = telefoneAutor || "";
  const decisao = classificarSentenca(String(it.texto || ""));
  const statusLabel = FILTROS_STATUS.find((f) => f.id === decisao)?.nomeTribunal || decisao || "";
  const materiaHits = matchMateria(String(it.texto || ""), materiaOn);
  const matLabel = materiaHits.map((id) => FILTROS_MATERIA.find((f) => f.id === id)?.nomeTribunal).filter(Boolean).join(" · ");
  const baClareadoLocal = !!extra?.tipo_ba;
  const decisaoLabel = {
    extinto_sem_merito: "Extinto sem resolução do mérito",
    extinto_com_merito: "Extinto com resolução do mérito",
    procedente: "Sentença procedente",
    improcedente: "Sentença improcedente",
    procedente_parcial: "Sentença procedente em parte",
    nao_classificada: "Sentença não classificada",
  }[decisao];
  return {
    processo: formatCnjMasked(digits),
    nome_completo: nome,
    telefone: tel,
    email: extractEmailFromDjenText(it.texto),
    cpf: cpfExtra || extractCpfFromDjenText(String(it.texto || "")) || "",
    cnpj: "",
    placa: placaExtra || "",
    renavam: renavamExtra || "",
    sem_advogado: extra?.sem_advogado || "NAO",
    tipo_ba: extra?.tipo_ba || "",
    ba_inicio: extra?.ba_inicio || "NAO",
    flags: extra?.flags || "",
    endereco: "",
    cep: "",
    bairro: "",
    municipio: "",
    uf: "",
    situacao_cadastral: "",
    telefone_fonte: tel ? "teor_djen_publico" : "",
    enrich_fonte: "",
    classe: String(it.nomeClasse || "").trim(),
    assunto_ou_teor: String(it.texto || "").replace(/\s+/g, " ").trim().slice(0, 240),
    situacao_hint: [statusLabel, matLabel, decisaoLabel].filter(Boolean).join(" · "),
    status_detectado: decisao,
    tribunal: String(it.siglaTribunal || sigla || "").toUpperCase(),
    data: String(it.data_disponibilizacao || "").slice(0, 10),
    link: djenLink(it, digits),
    filtros: [decisao, ...matLabel ? [matLabel] : []].filter(Boolean).join("|"),
    consultavel: true,
    ba_djen: baClareadoLocal,
  };
}
