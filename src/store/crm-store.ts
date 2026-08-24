"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Company, Person, Deal, Note, DealStage } from "@/lib/types";
import { SEED_COMPANIES, SEED_PEOPLE, SEED_DEALS, SEED_NOTES } from "@/lib/seed";

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

interface CrmState {
  companies: Company[];
  people: Person[];
  deals: Deal[];
  notes: Note[];
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  resetDemo: () => void;
  upsertCompany: (partial: Partial<Company> & { name: string }) => string;
  deleteCompany: (id: string) => void;
  upsertPerson: (partial: Partial<Person> & { name: string }) => string;
  deletePerson: (id: string) => void;
  upsertDeal: (partial: Partial<Deal> & { name: string; companyId: string }) => string;
  deleteDeal: (id: string) => void;
  addNote: (n: Omit<Note, "id" | "createdAt" | "author"> & { author?: string }) => void;
  deleteNote: (id: string) => void;
}

const stamp = () => new Date().toISOString();

export const useCrmStore = create<CrmState>()(
  persist(
    (set, get) => ({
      companies: SEED_COMPANIES,
      people: SEED_PEOPLE,
      deals: SEED_DEALS,
      notes: SEED_NOTES,
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      resetDemo: () =>
        set({
          companies: SEED_COMPANIES,
          people: SEED_PEOPLE,
          deals: SEED_DEALS,
          notes: SEED_NOTES,
        }),
      upsertCompany: (partial) => {
        const id = partial.id || newId();
        const existing = get().companies.find((c) => c.id === id);
        const row: Company = {
          id,
          name: partial.name,
          domain: partial.domain ?? existing?.domain,
          industry: partial.industry ?? existing?.industry,
          employees: partial.employees ?? existing?.employees,
          city: partial.city ?? existing?.city,
          country: partial.country ?? existing?.country ?? "BR",
          createdAt: existing?.createdAt || stamp(),
          updatedAt: stamp(),
        };
        set({
          companies: existing
            ? get().companies.map((c) => (c.id === id ? row : c))
            : [row, ...get().companies],
        });
        return id;
      },
      deleteCompany: (id) =>
        set({
          companies: get().companies.filter((c) => c.id !== id),
          people: get().people.map((p) => (p.companyId === id ? { ...p, companyId: undefined } : p)),
          deals: get().deals.filter((d) => d.companyId !== id),
        }),
      upsertPerson: (partial) => {
        const id = partial.id || newId();
        const existing = get().people.find((p) => p.id === id);
        const row: Person = {
          id,
          name: partial.name,
          companyId: partial.companyId ?? existing?.companyId,
          email: partial.email ?? existing?.email,
          phone: partial.phone ?? existing?.phone,
          role: partial.role ?? existing?.role,
          createdAt: existing?.createdAt || stamp(),
          updatedAt: stamp(),
        };
        set({
          people: existing
            ? get().people.map((p) => (p.id === id ? row : p))
            : [row, ...get().people],
        });
        return id;
      },
      deletePerson: (id) => set({ people: get().people.filter((p) => p.id !== id) }),
      upsertDeal: (partial) => {
        const id = partial.id || newId();
        const existing = get().deals.find((d) => d.id === id);
        const row: Deal = {
          id,
          companyId: partial.companyId,
          name: partial.name,
          amount: partial.amount ?? existing?.amount ?? 0,
          currency: partial.currency ?? existing?.currency ?? "BRL",
          stage: (partial.stage as DealStage) ?? existing?.stage ?? "lead",
          closeDate: partial.closeDate ?? existing?.closeDate,
          createdAt: existing?.createdAt || stamp(),
          updatedAt: stamp(),
        };
        set({
          deals: existing
            ? get().deals.map((d) => (d.id === id ? row : d))
            : [row, ...get().deals],
        });
        return id;
      },
      deleteDeal: (id) => set({ deals: get().deals.filter((d) => d.id !== id) }),
      addNote: (n) => {
        const note: Note = {
          id: newId(),
          body: n.body,
          companyId: n.companyId,
          personId: n.personId,
          dealId: n.dealId,
          createdAt: stamp(),
          author: n.author || "Você",
        };
        set({ notes: [note, ...get().notes] });
      },
      deleteNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),
    }),
    {
      name: "lexis-crm-v1",
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    }
  )
);
