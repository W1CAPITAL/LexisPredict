"use client";

import { useMemo, useState } from "react";
import { useCrmStore } from "@/store/crm-store";
import { PageHeader, Button, Input, Card, Select } from "@/components/ui";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function PeoplePage() {
  const { people, companies, upsertPerson, deletePerson } = useCrmStore();
  const [q, setQ] = useState("");
  const [companyId, setCompanyId] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cid, setCid] = useState("");

  const list = useMemo(() => {
    let rows = [...people];
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s));
    }
    if (companyId !== "all") rows = rows.filter((p) => p.companyId === companyId);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [people, q, companyId]);

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${list.length} pessoas`} actions={
        <Button onClick={() => setShowNew(true)}><Plus className="size-4" /> Novo contato</Button>
      } />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="max-w-xs" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="max-w-[220px]" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="all">Todas empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      {showNew && (
        <Card className="p-4 mb-4 grid sm:grid-cols-3 gap-2">
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={cid} onChange={(e) => setCid(e.target.value)}>
            <option value="">Sem empresa</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="sm:col-span-3 flex gap-2">
            <Button onClick={() => {
              if (!name.trim()) return;
              upsertPerson({ name: name.trim(), email: email || undefined, companyId: cid || undefined });
              setName(""); setEmail(""); setCid(""); setShowNew(false);
            }}>Salvar</Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
        </Card>
      )}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">E-mail</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Cargo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const co = companies.find((c) => c.id === p.companyId);
              return (
                <tr key={p.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-ink-600 hidden sm:table-cell">{p.email || "—"}</td>
                  <td className="px-4 py-3">
                    {co ? <Link className="text-accent hover:underline" href={`/companies/${co.id}`}>{co.name}</Link> : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-600 hidden md:table-cell">{p.role || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="text-rose-600" onClick={() => deletePerson(p.id)}>Excluir</Button>
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
