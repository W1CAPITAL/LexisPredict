"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCrmStore } from "@/store/crm-store";
import { PageHeader, Button, Input, Textarea, Card, Badge, Select } from "@/components/ui";
import { money, relative } from "@/lib/format";
import { STAGE_COLOR, STAGE_LABEL, DealStage } from "@/lib/types";
import Link from "next/link";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { companies, people, deals, notes, upsertCompany, deleteCompany, upsertPerson, upsertDeal, addNote } =
    useCrmStore();

  const company = companies.find((c) => c.id === id);
  const companyPeople = people.filter((p) => p.companyId === id);
  const companyDeals = deals.filter((d) => d.companyId === id);
  const timeline = useMemo(
    () => notes.filter((n) => n.companyId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes, id]
  );

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(company || null);
  const [noteBody, setNoteBody] = useState("");
  const [personName, setPersonName] = useState("");
  const [dealName, setDealName] = useState("");
  const [dealAmount, setDealAmount] = useState("0");
  const [dealStage, setDealStage] = useState<DealStage>("lead");

  if (!company) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-500">Empresa não encontrada</p>
        <Button className="mt-4" onClick={() => router.push("/companies")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={[company.domain, company.industry, company.city].filter(Boolean).join(" · ")}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setForm(company); setEdit(!edit); }}>
              {edit ? "Fechar" : "Editar"}
            </Button>
            <Button variant="danger" onClick={() => {
              if (confirm("Excluir empresa?")) { deleteCompany(company.id); router.push("/companies"); }
            }}>Excluir</Button>
          </div>
        }
      />
      {edit && form && (
        <Card className="p-4 mb-4 grid sm:grid-cols-2 gap-3">
          {(["name", "domain", "industry", "employees", "city", "country"] as const).map((k) => (
            <div key={k}>
              <label className="text-[11px] text-ink-400 capitalize">{k}</label>
              <Input value={(form as any)[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button onClick={() => { upsertCompany(form); setEdit(false); }}>Salvar alterações</Button>
          </div>
        </Card>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-3">Timeline</h2>
            <Textarea className="mb-2" placeholder="Nota sobre o cliente…" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
            <Button disabled={!noteBody.trim()} onClick={() => { addNote({ companyId: id, body: noteBody.trim() }); setNoteBody(""); }}>
              Adicionar nota
            </Button>
            <ul className="mt-5 space-y-4">
              {timeline.map((n) => (
                <li key={n.id} className="border-l-2 border-ink-200 pl-3">
                  <p className="text-sm text-ink-800 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-[11px] text-ink-400 mt-1">{n.author} · {relative(n.createdAt)}</p>
                </li>
              ))}
              {timeline.length === 0 && <p className="text-sm text-ink-400 mt-4">Sem notas ainda</p>}
            </ul>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-3">Pessoas</h2>
            <ul className="space-y-2 mb-3">
              {companyPeople.map((p) => (
                <li key={p.id} className="text-sm">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-ink-400">{p.role || p.email || "—"}</p>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input placeholder="Nome" value={personName} onChange={(e) => setPersonName(e.target.value)} />
              <Button onClick={() => { if (!personName.trim()) return; upsertPerson({ name: personName.trim(), companyId: id }); setPersonName(""); }}>+</Button>
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-3">Oportunidades</h2>
            <ul className="space-y-2 mb-3">
              {companyDeals.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <Badge className={STAGE_COLOR[d.stage]}>{STAGE_LABEL[d.stage]}</Badge>
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="tabular-nums text-ink-600">{money(d.amount)}</span>
                </li>
              ))}
            </ul>
            <Input className="mb-2" placeholder="Nome do deal" value={dealName} onChange={(e) => setDealName(e.target.value)} />
            <Input className="mb-2" type="number" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} />
            <Select className="mb-2" value={dealStage} onChange={(e) => setDealStage(e.target.value as DealStage)}>
              {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button className="w-full" onClick={() => {
              if (!dealName.trim()) return;
              upsertDeal({ name: dealName.trim(), companyId: id, amount: Number(dealAmount) || 0, stage: dealStage });
              setDealName(""); setDealAmount("0");
            }}>Criar oportunidade</Button>
          </Card>
          <Link href="/companies" className="text-sm text-accent hover:underline">← Todas as empresas</Link>
        </div>
      </div>
    </div>
  );
}
