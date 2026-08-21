"use client";

import { useMemo, useState } from "react";
import { gerarParcelasAcordo } from "@/lib/cobranca-historico";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  receberId: string;
  clienteNome: string;
  valorTotal: number;
  onConfirm: (parcelas: ReturnType<typeof gerarParcelasAcordo>) => void;
  onCancel: () => void;
};

export function AcordoDialog({ receberId, clienteNome, valorTotal, onConfirm, onCancel }: Props) {
  const [parcelas, setParcelas] = useState(3);
  const [primeiraData, setPrimeiraData] = useState(() => new Date().toISOString().slice(0, 10));

  const preview = useMemo(
    () =>
      gerarParcelasAcordo({
        receberId,
        clienteNome,
        valorTotal,
        parcelas,
        primeiraData,
        forma: "acordo",
      }),
    [receberId, clienteNome, valorTotal, parcelas, primeiraData]
  );

  return (
    <div className="space-y-4 p-1">
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase">Acordo — {clienteNome}</p>
        <p className="text-lg font-black">
          {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] font-black uppercase">Parcelas</Label>
          <Input
            type="number"
            min={1}
            max={24}
            value={parcelas}
            onChange={(e) => setParcelas(Number(e.target.value) || 1)}
            className="h-11 rounded-xl"
          />
        </div>
        <div>
          <Label className="text-[10px] font-black uppercase">1ª parcela</Label>
          <Input
            type="date"
            value={primeiraData}
            onChange={(e) => setPrimeiraData(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
      </div>
      <ul className="max-h-40 overflow-auto text-[11px] space-y-1 border rounded-xl p-3 bg-secondary/20">
        {preview.map((p) => (
          <li key={p.n} className="flex justify-between gap-2">
            <span>
              {p.n}/{preview.length} · {p.vencimento}
            </span>
            <strong>
              {p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
          Cancelar
        </Button>
        <Button className="flex-1 rounded-xl bg-black text-white" onClick={() => onConfirm(preview)}>
          Confirmar acordo
        </Button>
      </div>
    </div>
  );
}
