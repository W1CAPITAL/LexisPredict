"use client";

import { useMemo, useState } from "react";
import { useCrmStore } from "@/store/crm-store";
import { PageHeader, Button, Input, Card, Select, Badge } from "@/components/ui";
import { STAGE_COLOR, STAGE_LABEL, DealStage } from "@/lib/types";
import { money } from "@/lib/format";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function DealsPage() {
  const { deals, companies, upsertDeal, deleteDeal } = useCrmStore();
  const [stage, setStage] = useState<string>("all");
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("0");
  const [companyId, setCompanyId] = useState("");
  const [st, setSt] = useState<DealStage>("lead");

  const list = useMemo(() => {
    let rows = [...deals];
    if (stage !== "all") rows = rows.filter((d) => d.stage === stage);
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((d) => d.name.toLowerCase().includes(s));
    }
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [deals, stage, q]);

  const total = list.reduce((s, d) => s + d.amount, 0);

  return (
    <div>
      <PageHeader title="Oportunidades" subtitle={`${list.length} deals · ${money(total)}`} actions={
        <Button onClick={() => setShowNew(true)}><Plus className="size-4" /> Nova oportunidade</Button>
      } />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="max-w-xs" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="max-w-[180px]" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="all">Todos estágios</option>
          {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {showNew && (
        <Card className="p-4 mb-4 grid sm:grid-cols-2 gap-2">
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="number" placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Empresa</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={st} onChange={(e) => setSt(e.target.value as DealStage)}>
            {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <div className="sm:col-span-2 flex gap-2">
            <Button onClick={() => {
              if (!name.trim() || !companyId) return;
              upsertDeal({ name: name.trim(), companyId, amount: Number(amount) || 0, stage: st });
              setShowNew(false); setName(""); setAmount("0"); setCompanyId("");
            }}>Salvar</Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
        </Card>
      )}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Oportunidade</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Estágio</th>
              <th className="px-4 py-3 font-medium text-right">Valor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => {
              const co = companies.find((c) => c.id === d.companyId);
              return (
                <tr key={d.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3">
                    {co ? <Link href={`/companies/${co.id}`} className="text-accent hover:underline">{co.name}</Link> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      className="max-w-[140px] py-1"
                      value={d.stage}
                      onChange={(e) => upsertDeal({ ...d, stage: e.target.value as DealStage })}
                    >
                      {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(d.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="text-rose-600" onClick={() => deleteDeal(d.id)}>Excluir</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
