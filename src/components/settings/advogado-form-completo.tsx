"use client";

/**
 * Modal completo da banca — espelha colunas de advogados_banca (CSV/Supabase).
 */
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { upsertAdvogadoBanca } from "@/lib/server-db";
import { useToast } from "@/hooks/use-toast";
import { OabLookupButton } from "@/components/settings/oab-lookup-button";

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export type AdvForm = {
  id?: string;
  nome: string;
  genero: string;
  nacionalidade: string;
  estadoCivil: string;
  cpf: string;
  rg: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  email: string;
  emailProfissional: string;
  telefone: string;
  celular: string;
  site: string;
  observacao: string;
  oabs: { uf: string; num: string }[];
};

export const EMPTY_ADV: AdvForm = {
  nome: "",
  genero: "M",
  nacionalidade: "brasileiro",
  estadoCivil: "casado",
  cpf: "",
  rg: "",
  endereco: "",
  cidade: "",
  uf: "SP",
  cep: "",
  email: "",
  emailProfissional: "",
  telefone: "",
  celular: "",
  site: "",
  observacao: "",
  oabs: [{ uf: "SP", num: "" }],
};

export function rowToAdvForm(adv: any): AdvForm {
  const oabList = Object.entries(adv?.oabs || {}).map(([uf, num]) => ({
    uf: String(uf),
    num: String(num || ""),
  }));
  return {
    id: adv?.id,
    nome: (adv?.nome || "").trim(),
    genero: adv?.genero || "M",
    nacionalidade: adv?.nacionalidade || "brasileiro",
    estadoCivil: adv?.estado_civil || "casado",
    cpf: adv?.cpf || "",
    rg: adv?.rg || "",
    endereco: adv?.endereco || "",
    cidade: adv?.cidade || "",
    uf: adv?.uf || "SP",
    cep: adv?.cep || "",
    email: adv?.email || "",
    emailProfissional: adv?.email_profissional || "",
    telefone: adv?.telefone || "",
    celular: adv?.celular || "",
    site: adv?.site || "",
    observacao: adv?.observacao || "",
    oabs: oabList.length ? oabList : [{ uf: "SP", num: "" }],
  };
}

export function AdvogadoFormCompleto({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AdvForm | null;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [f, setF] = useState<AdvForm>(EMPTY_ADV);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setF(initial ? { ...EMPTY_ADV, ...initial } : { ...EMPTY_ADV, oabs: [{ uf: "SP", num: "" }] });
  }, [open, initial]);

  const set = <K extends keyof AdvForm>(k: K, v: AdvForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const oabs: Record<string, string> = {};
    f.oabs.forEach((o) => {
      if (o.uf && o.num.trim()) oabs[o.uf] = o.num.trim();
    });
    if (!f.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!Object.keys(oabs).length) {
      toast({ title: "Informe ao menos uma OAB", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        id: f.id,
        nome: f.nome.trim().toUpperCase(),
        genero: f.genero,
        nacionalidade: f.nacionalidade,
        estado_civil: f.estadoCivil,
        cpf: f.cpf.replace(/\D/g, "") || null,
        rg: f.rg || null,
        endereco: f.endereco || null,
        cidade: f.cidade || null,
        uf: f.uf || null,
        cep: (f.cep || "").replace(/\D/g, "") || null,
        email: f.email || null,
        email_profissional: f.emailProfissional || null,
        telefone: f.telefone || null,
        celular: f.celular || null,
        site: f.site || null,
        observacao: f.observacao || null,
        oabs,
        ativo: true,
      };
      const res = await upsertAdvogadoBanca(payload);
      if (res?.success) {
        toast({ title: "Advogado salvo" });
        onOpenChange(false);
        onSaved?.();
      } else {
        toast({
          title: "Erro ao salvar",
          description:
            (res as any)?.error ||
            "Confira se as colunas existem no Supabase (telefone, celular, cidade, etc.).",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto sm:rounded-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">
              Perfil de advogado
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dados para procuração, petição e identificação. Todos os campos abaixo são gravados em{" "}
              <code>advogados_banca</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-xs">
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase">Nome completo *</Label>
              <Input
                value={f.nome}
                onChange={(e) => set("nome", e.target.value.toUpperCase())}
                className="h-11 uppercase font-bold rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Gênero</Label>
                <Select value={f.genero} onValueChange={(v) => set("genero", v)}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="O">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Nacionalidade</Label>
                <Input value={f.nacionalidade} onChange={(e) => set("nacionalidade", e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-[9px] font-black uppercase">Estado civil (texto livre)</Label>
                <Input value={f.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)} className="h-10 text-xs rounded-xl" placeholder="casado, casada, casado(a)…" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">CPF</Label>
                <Input value={f.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">RG</Label>
                <Input value={f.rg} onChange={(e) => set("rg", e.target.value)} className="h-10 rounded-xl" />
              </div>
            </div>

            {/* OABs */}
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex justify-between items-center">
                <Label className="text-[9px] font-black uppercase">OABs *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[9px] font-black uppercase"
                  onClick={() => set("oabs", [...f.oabs, { uf: "SP", num: "" }])}
                >
                  <Plus size={12} className="mr-1" /> Add UF
                </Button>
              </div>
              {f.oabs.map((o, idx) => (
                <div key={idx} className="flex flex-wrap gap-2 items-center">
                  <Select
                    value={o.uf}
                    onValueChange={(v) => {
                      const n = [...f.oabs];
                      n[idx] = { ...n[idx], uf: v };
                      set("oabs", n);
                    }}
                  >
                    <SelectTrigger className="w-20 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={o.num}
                    onChange={(e) => {
                      const n = [...f.oabs];
                      n[idx] = { ...n[idx], num: e.target.value };
                      set("oabs", n);
                    }}
                    placeholder="238.759/MG"
                    className="h-10 rounded-xl flex-1 min-w-[120px]"
                  />
                  <OabLookupButton
                    uf={o.uf}
                    numero={o.num}
                    onFound={(d) => {
                      if (d.nome) set("nome", d.nome);
                    }}
                  />
                  {f.oabs.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => set("oabs", f.oabs.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Contato — colunas do CSV */}
            <div className="space-y-2 rounded-xl border p-3">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Correio eletrônico e telefones</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">E-mail profissional</Label>
                  <Input type="email" value={f.emailProfissional} onChange={(e) => set("emailProfissional", e.target.value)} className="h-10 rounded-xl" placeholder="nome@adv.oabsp.org.br" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">E-mail</Label>
                  <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Telefone</Label>
                  <Input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} className="h-10 rounded-xl" placeholder="(11) 3000-0000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Celular</Label>
                  <Input value={f.celular} onChange={(e) => set("celular", e.target.value)} className="h-10 rounded-xl" placeholder="(11) 90000-0000" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[9px] font-black uppercase">Site</Label>
                  <Input value={f.site} onChange={(e) => set("site", e.target.value)} className="h-10 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-2 rounded-xl border p-3">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Endereço profissional</Label>
              <Input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} className="h-10 rounded-xl" placeholder="Rua, número, sala" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1 col-span-2">
                  <Label className="text-[9px] font-black uppercase">Cidade</Label>
                  <Input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">UF</Label>
                  <Select value={f.uf} onValueChange={(v) => set("uf", v)}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">CEP</Label>
                  <Input value={f.cep} onChange={(e) => set("cep", e.target.value)} className="h-10 rounded-xl" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase">Observação</Label>
              <Textarea value={f.observacao} onChange={(e) => set("observacao", e.target.value)} rows={3} className="rounded-xl text-xs" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving} className="w-full h-12 font-black uppercase text-[10px] tracking-widest rounded-xl">
              {saving ? <Loader2 className="animate-spin" size={16} /> : "Salvar advogado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
