"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCrmStore } from "@/store/crm-store";
import { PageHeader, Button, Input, Card, Select } from "@/components/ui";
import { Plus, ArrowUpDown } from "lucide-react";

export default function CompaniesPage() {
  const { companies, people, deals, upsertCompany } = useCrmStore();
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("all");
  const [sort, setSort] = useState<"name" | "updated">("updated");
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");

  const industries = useMemo(() => {
    const s = new Set(companies.map((c) => c.industry).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [companies]);

  const list = useMemo(() => {
    let rows = [...companies];
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.domain?.toLowerCase().includes(s) ||
          c.city?.toLowerCase().includes(s)
      );
    }
    if (industry !== "all") rows = rows.filter((c) => c.industry === industry);
    rows.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt)
    );
    return rows;
  }, [companies, q, industry, sort]);

  const create = () => {
    if (!name.trim()) return;
    const id = upsertCompany({ name: name.trim(), domain: domain.trim() || undefined });
    setName("");
    setDomain("");
    setShowNew(false);
    window.location.href = `/companies/${id}`;
  };

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle={`${list.length} registros`}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="size-4" /> Nova empresa
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="max-w-xs" placeholder="Filtrar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={industry} onChange={(e) => setIndustry(e.target.value)} className="max-w-[180px]">
          <option value="all">Todos setores</option>
          {industries.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </Select>
        <Button variant="ghost" onClick={() => setSort(sort === "name" ? "updated" : "name")}>
          <ArrowUpDown className="size-3.5" /> {sort === "name" ? "Nome" : "Recentes"}
        </Button>
      </div>
      {showNew && (
        <Card className="p-4 mb-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] text-ink-400">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Empresa" autoFocus />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] text-ink-400">Domínio</label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="empresa.com" />
          </div>
          <Button onClick={create}>Salvar</Button>
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
        </Card>
      )}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Setor</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Cidade</th>
              <th className="px-4 py-3 font-medium text-right">Pessoas</th>
              <th className="px-4 py-3 font-medium text-right">Deals</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-ink-100 hover:bg-accent-soft/40">
                <td className="px-4 py-3">
                  <Link href={`/companies/${c.id}`} className="font-medium text-ink-900 hover:text-accent">{c.name}</Link>
                  {c.domain && <p className="text-xs text-ink-400">{c.domain}</p>}
                </td>
                <td className="px-4 py-3 text-ink-600 hidden sm:table-cell">{c.industry || "—"}</td>
                <td className="px-4 py-3 text-ink-600 hidden md:table-cell">{c.city || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-600">{people.filter((p) => p.companyId === c.id).length}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-600">{deals.filter((d) => d.companyId === c.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-8 text-center text-sm text-ink-400">Nenhuma empresa</p>}
      </Card>
    </div>
  );
}
