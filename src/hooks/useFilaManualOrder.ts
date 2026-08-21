"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "lexis_tarefas_manual_order_v1";

/**
 * Ordem manual por id de cliente/grupo (persistida no browser).
 * Para drag-and-drop leve: chame moveUp / moveDown ou setOrder.
 */
export function useFilaManualOrder() {
  const [order, setOrderState] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setOrderState(JSON.parse(raw));
    } catch {
      /* */
    }
  }, []);

  const setOrder = useCallback((ids: string[]) => {
    setOrderState(ids);
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* */
    }
  }, []);

  const applyOrder = useCallback(
    <T extends { cliente?: string; id?: string }>(items: T[]): T[] => {
      if (!order.length) return items;
      const rank = new Map(order.map((id, i) => [id, i]));
      return [...items].sort((a, b) => {
        const ka = String(a.cliente || a.id || "");
        const kb = String(b.cliente || b.id || "");
        const ra = rank.has(ka) ? rank.get(ka)! : 9999;
        const rb = rank.has(kb) ? rank.get(kb)! : 9999;
        return ra - rb;
      });
    },
    [order]
  );

  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      setOrderState((prev) => {
        const list = prev.includes(id) ? [...prev] : [...prev, id];
        const i = list.indexOf(id);
        const j = i + dir;
        if (j < 0 || j >= list.length) return list;
        [list[i], list[j]] = [list[j], list[i]];
        try {
          localStorage.setItem(KEY, JSON.stringify(list));
        } catch {
          /* */
        }
        return list;
      });
    },
    []
  );

  return { order, setOrder, applyOrder, moveUp: (id: string) => move(id, -1), moveDown: (id: string) => move(id, 1) };
}
