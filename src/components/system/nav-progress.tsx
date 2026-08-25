"use client";

/**
 * Barra fina no topo ao trocar de rota (sem “F5” branco).
 */
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavProgressInner() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setActive(true);
    setWidth(18);
    const t1 = setTimeout(() => setWidth(55), 80);
    const t2 = setTimeout(() => setWidth(78), 200);
    const t3 = setTimeout(() => {
      setWidth(100);
      setTimeout(() => {
        setActive(false);
        setWidth(0);
      }, 220);
    }, 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname, search]);

  if (!active && width === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-[200] h-[2.5px] bg-transparent"
    >
      <div
        className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <NavProgressInner />
    </Suspense>
  );
}
