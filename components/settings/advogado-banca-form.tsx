"use client";

/**
 * Formulário completo da banca — dados para procuração e petições.
 */
import React, { useState, useEffect } from "react";
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
import { Loader2, Plus, Trash2, MapPin, Mail, Phone, User, Fingerprint } from "lucide-react";
import { upsertAdvogadoBanca } from "@/lib/server-db";
import { useToast } from "@/hooks/use-toast";

export type AdvogadoFormState = {
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

export const EMPTY_ADV_FORM: AdvogadoFormState = {
  nome: "",
  genero: "M",
  nacionalidade: "brasileiro",
  estadoCivil: "solteiro",
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

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function advFromRow(adv: any): AdvogadoFormState {
  const oabList = Object.entries(adv?.oabs || {}).map(([uf, num]) => ({
    uf,
    num: String(num || ""),
  }));
  return {
    id: adv?.id,
    nome: adv?.nome || "",
    genero: adv?.genero || "M",
    nacionalidade: adv?.nacionalidade || (adv?.genero === "F" ? "brasileira" : "brasileiro"),
    estadoCivil: adv?.estado_civil || adv?.estadoCivil || "solteiro",
    cpf: adv?.cpf || "",
    rg: adv?.rg || "",
    endereco: adv?.endereco || "",
    cidade: adv?.cidade || "",
    uf: adv?.uf || "SP",
    cep: adv?.cep || "",
    email: adv?.email || "",
    emailProfissional: adv?.email_profissional || adv?.emailProfissional || "",
    telefone: adv?.telefone || "",
    celular: adv?.celular || "",
    site: adv?.site || "",
    observacao: adv?.observacao || "",
    oabs: oabList.length ? oabList : [{ uf: "SP", num: "" }],
  };
}

export function AdvogadoBancaDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AdvogadoFormState | null;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<AdvogadoFormState>(EMPTY_ADV_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? { ...EMPTY_ADV_FORM, ...initial } : { ...EMPTY_ADV_FORM });
  }, [open, initial]);

  const set = <K extends keyof AdvogadoFormState>(k: K, v: AdvogadoFormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const oabsJson: Record<string, string> = {};
    form.oabs.forEach((o) => {
      if (o.uf && o.num) oabsJson[o.uf] = o.num.trim();
    });
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome", variant: "destructive" });
      return;
    }
    if (Object.keys(oabsJson).length === 0) {
      toast({ title: "Informe ao menos uma OAB", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        id: form.id,
        nome: form.nome.trim().toUpperCase(),
        genero: form.genero,
        nacionalidade: form.nacionalidade,
        estado_civil: form.estadoCivil,
        cpf: form.cpf.replace(/\D/g, "") || null,
        rg: form.rg || null,
        endereco: form.endereco || null,
        cidade: form.cidade || null,
        uf: form.uf || null,
        cep: form.cep.replace(/\D/g, "") || null,
        email: form.email || null,
        email_profissional: form.emailProfissional || null,
        telefone: form.telefone || null,
        celular: form.celular || null,
        site: form.site || null,
        observacao: form.observacao || null,
        oabs: oabsJson,
        ativo: true,
      };
      const res = await upsertAdvogadoBanca(payload);
      if (res.success) {
        toast({ title: "Advogado sincronizado" });
        onOpenChange(false);
        onSaved?.();
      } else {
        toast({
          title: "Erro ao salvar",
          description: (res as any).error || "Verifique se as colunas existem no Supabase (SQL do pacote).",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">
              Perfil de advogado (procuração)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dados usados em procurações, petições e identificação na banca. Preencha o máximo possível.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Identidade */}
            <section className="space-y-3 rounded-xl border border-border/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <User size={12} /> Identidade
              </p>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Nome completo *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value.toUpperCase())}
                  className="h-11 uppercase font-bold text-xs rounded-xl"
                  required
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Gênero</Label>
                  <Select value={form.genero} onValueChange={(v) => set("genero", v)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="O">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Nacionalidade</Label>
                  <Input
                    value={form.nacionalidade}
                    onChange={(e) => set("nacionalidade", e.target.value)}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-[9px] font-black uppercase">Estado civil</Label>
                  <Select value={form.estadoCivil} onValueChange={(v) => set("estadoCivil", v)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                      <SelectItem value="casado">Casado(a)</SelectItem>
                      <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      <SelectItem value="uniao_estavel">União estável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase flex items-center gap-1">
                    <Fingerprint size={11} /> CPF
                  </Label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => set("cpf", e.target.value)}
                    placeholder="000.000.000-00"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">RG</Label>
                  <Input
                    value={form.rg}
                    onChange={(e) => set("rg", e.target.value)}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>
            </section>

            {/* OAB */}
            <section className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  OAB *
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[9px] font-black uppercase"
                  onClick={() => set("oabs", [...form.oabs, { uf: "SP", num: "" }])}
                >
                  <Plus size={12} className="mr-1" /> Add UF
                </Button>
              </div>
              {form.oabs.map((o, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select
                    value={o.uf}
                    onValueChange={(v) => {
                      const next = [...form.oabs];
                      next[idx] = { ...next[idx], uf: v };
                      set("oabs", next);
                    }}
                  >
                    <SelectTrigger className="w-24 h-10 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={o.num}
                    onChange={(e) => {
                      const next = [...form.oabs];
                      next[idx] = { ...next[idx], num: e.target.value };
                      set("oabs", next);
                    }}
                    placeholder="Número"
                    className="h-10 text-xs rounded-xl flex-1"
                  />
                  {form.oabs.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => set("oabs", form.oabs.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </section>

            {/* Contato */}
            <section className="space-y-3 rounded-xl border border-border/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Mail size={12} /> Correio eletrônico e telefones
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">E-mail profissional</Label>
                  <Input
                    type="email"
                    value={form.emailProfissional}
                    onChange={(e) => set("emailProfissional", e.target.value)}
                    placeholder="advogado@escritorio.com"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">E-mail alternativo</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase flex items-center gap-1">
                    <Phone size={11} /> Telefone profissional
                  </Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => set("telefone", e.target.value)}
                    placeholder="(11) 3000-0000"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Celular / WhatsApp</Label>
                  <Input
                    value={form.celular}
                    onChange={(e) => set("celular", e.target.value)}
                    placeholder="(11) 90000-0000"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[9px] font-black uppercase">Site</Label>
                  <Input
                    value={form.site}
                    onChange={(e) => set("site", e.target.value)}
                    placeholder="https://"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>
            </section>

            {/* Endereço */}
            <section className="space-y-3 rounded-xl border border-border/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <MapPin size={12} /> Endereço profissional
              </p>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Logradouro, número, complemento</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => set("endereco", e.target.value)}
                  placeholder="Rua Exemplo, 100, Sala 2"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-[9px] font-black uppercase">Cidade</Label>
                  <Input
                    value={form.cidade}
                    onChange={(e) => set("cidade", e.target.value)}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">UF</Label>
                  <Select value={form.uf} onValueChange={(v) => set("uf", v)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">CEP</Label>
                  <Input
                    value={form.cep}
                    onChange={(e) => set("cep", e.target.value)}
                    placeholder="00000-000"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>
            </section>

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase">Observações (procuração / uso interno)</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => set("observacao", e.target.value)}
                rows={3}
                className="text-xs rounded-xl"
                placeholder="Ex.: substabelecimento com reserva; foro preferencial…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={saving}
              className="w-full h-12 font-black uppercase text-[10px] tracking-widest rounded-xl"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : "Salvar advogado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
