"use client";

/**
 * Painel de revisão: banca + advogados + cliente — 100% campos livres.
 * Chips só sugerem valores (casada, brasileira…); não travam o input.
 */

import React, { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type PartePessoa,
  type AdvogadoEditavel,
  type BancaLocal,
  SUGESTOES_ESTADO_CIVIL,
  SUGESTOES_NACIONALIDADE,
  SUGESTOES_PROFISSAO,
  saveBancaLocal,
  saveAdvogadosLocal,
  loadBancaLocal,
  loadAdvogadosLocal,
  emptyAdvogado,
  qualificarCliente,
  qualificarAdvogado,
} from "@/lib/partes-editaveis";
import { Plus, Trash2, Save, User, Scale, Building2 } from "lucide-react";

type Props = {
  banca: BancaLocal;
  setBanca: (b: BancaLocal) => void;
  advogados: AdvogadoEditavel[];
  setAdvogados: (a: AdvogadoEditavel[]) => void;
  cliente: PartePessoa;
  setCliente: (c: PartePessoa) => void;
  tituloCliente?: string;
  className?: string;
};

function ChipRow({
  items,
  onPick,
}: {
  items: string[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 hover:bg-primary/15 hover:border-primary/30 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  chips,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  chips?: string[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Digite livremente…"}
        className="h-10 rounded-xl"
      />
      {chips ? <ChipRow items={chips} onPick={onChange} /> : null}
    </div>
  );
}

export function EditablePartesPanel({
  banca,
  setBanca,
  advogados,
  setAdvogados,
  cliente,
  setCliente,
  tituloCliente = "Outorgante / Cliente",
  className,
}: Props) {
  useEffect(() => {
    // hidrata do localStorage se vazio
    if (!banca.nome_escritorio && !banca.endereco) {
      const b = loadBancaLocal();
      if (b.nome_escritorio || b.endereco) setBanca(b);
    }
    if (!advogados.length) {
      const a = loadAdvogadosLocal();
      if (a.length) setAdvogados(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = () => {
    saveBancaLocal(banca);
    saveAdvogadosLocal(advogados);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
            <Scale size={16} className="text-primary" />
            Partes editáveis
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Tudo é texto livre. Chips só sugerem (ex.: casada, casado(a)). O PDF usa exatamente o que você digitar.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" className="gap-1.5 rounded-xl" onClick={persist}>
          <Save size={14} /> Salvar banca neste navegador
        </Button>
      </div>

      {/* Banca */}
      <section className="rounded-2xl border border-border/60 bg-card/50 p-4 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
          <Building2 size={14} /> Banca / escritório
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome do escritório" value={banca.nome_escritorio} onChange={(v) => setBanca({ ...banca, nome_escritorio: v })} />
          <Field label="Cidade" value={banca.cidade} onChange={(v) => setBanca({ ...banca, cidade: v })} />
          <Field label="Endereço" value={banca.endereco} onChange={(v) => setBanca({ ...banca, endereco: v })} />
          <Field label="CNPJ" value={banca.cnpj || ""} onChange={(v) => setBanca({ ...banca, cnpj: v })} />
          <Field label="E-mail" value={banca.email || ""} onChange={(v) => setBanca({ ...banca, email: v })} />
          <Field label="Telefone" value={banca.telefone || ""} onChange={(v) => setBanca({ ...banca, telefone: v })} />
        </div>
      </section>

      {/* Cliente */}
      <section className="rounded-2xl border border-border/60 bg-card/50 p-4 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
          <User size={14} /> {tituloCliente}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome completo" value={cliente.nome} onChange={(v) => setCliente({ ...cliente, nome: v })} />
          <Field
            label="Nacionalidade"
            value={cliente.nacionalidade}
            onChange={(v) => setCliente({ ...cliente, nacionalidade: v })}
            chips={SUGESTOES_NACIONALIDADE}
          />
          <Field
            label="Estado civil"
            value={cliente.estado_civil || cliente.estadoCivil || ""}
            onChange={(v) => setCliente({ ...cliente, estado_civil: v, estadoCivil: v })}
            chips={SUGESTOES_ESTADO_CIVIL}
            placeholder="casado, casada, casado(a)…"
          />
          <Field
            label="Profissão"
            value={cliente.profissao}
            onChange={(v) => setCliente({ ...cliente, profissao: v })}
            chips={SUGESTOES_PROFISSAO}
          />
          <Field label="RG" value={cliente.rg} onChange={(v) => setCliente({ ...cliente, rg: v })} />
          <Field label="CPF" value={cliente.cpf} onChange={(v) => setCliente({ ...cliente, cpf: v })} />
          <Field label="Endereço" value={cliente.endereco} onChange={(v) => setCliente({ ...cliente, endereco: v })} />
          <Field label="E-mail" value={cliente.email} onChange={(v) => setCliente({ ...cliente, email: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase text-muted-foreground">
            Qualificação livre (opcional — se preencher, o PDF usa este parágrafo inteiro)
          </Label>
          <Textarea
            value={cliente.qualificacao || ""}
            onChange={(e) => setCliente({ ...cliente, qualificacao: e.target.value })}
            rows={3}
            placeholder="Ex.: MARIA SILVA, brasileira, casada, empresária, portadora do RG…"
            className="rounded-xl text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Prévia automática: {qualificarCliente(cliente) || "—"}
          </p>
        </div>
      </section>

      {/* Advogados */}
      <section className="rounded-2xl border border-border/60 bg-card/50 p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
            <Scale size={14} /> Advogados
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl gap-1"
            onClick={() => setAdvogados([...advogados, emptyAdvogado()])}
          >
            <Plus size={14} /> Advogado
          </Button>
        </div>

        {(advogados.length ? advogados : [emptyAdvogado()]).map((adv, idx) => {
          const list = advogados.length ? advogados : [adv];
          const update = (patch: Partial<AdvogadoEditavel>) => {
            const next = [...(advogados.length ? advogados : [emptyAdvogado()])];
            next[idx] = { ...next[idx], ...patch };
            setAdvogados(next);
          };
          return (
            <div key={idx} className="rounded-xl border border-border/40 p-3 space-y-3 bg-background/40">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">
                  Advogado {idx + 1}
                </Badge>
                {advogados.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setAdvogados(advogados.filter((_, i) => i !== idx))}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Nome" value={adv.nome} onChange={(v) => update({ nome: v })} />
                <Field
                  label="Nacionalidade"
                  value={adv.nacionalidade}
                  onChange={(v) => update({ nacionalidade: v })}
                  chips={SUGESTOES_NACIONALIDADE}
                />
                <Field
                  label="Estado civil"
                  value={adv.estado_civil || adv.estadoCivil || ""}
                  onChange={(v) => update({ estado_civil: v, estadoCivil: v })}
                  chips={SUGESTOES_ESTADO_CIVIL}
                />
                <Field label="OAB nº" value={adv.oab} onChange={(v) => update({ oab: v })} />
                <Field label="OAB UF" value={adv.oab_uf || ""} onChange={(v) => update({ oab_uf: v })} placeholder="SP" />
                <Field label="Endereço profissional" value={adv.endereco} onChange={(v) => update({ endereco: v })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Qualificação livre do advogado
                </Label>
                <Textarea
                  value={adv.qualificacao || ""}
                  onChange={(e) => update({ qualificacao: e.target.value })}
                  rows={2}
                  className="rounded-xl text-sm"
                  placeholder="Texto livre para o PDF…"
                />
                <p className="text-[10px] text-muted-foreground">
                  Prévia: {qualificarAdvogado({ ...adv, ...list[idx] }) || "—"}
                </p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default EditablePartesPanel;
