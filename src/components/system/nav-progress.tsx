"use client";

/** Barra de progresso real de navegação: inicia no clique do link e conclui
 * quando a URL do App Router muda. Nunca adiciona espera artificial.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isInternalNavigation(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const source = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!source || source.hasAttribute("download") || source.getAttribute("aria-disabled") === "true") return false;
  if (source.target && source.target !== "_self") return false;
  try {
    const target = new URL(source.href, window.location.href);
    return target.origin === window.location.origin &&
      (target.pathname + target.search !== window.location.pathname + window.location.search);
  } catch { return false; }
}

function NavProgressInner() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const activeRef = useRef(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const initial = useRef(true);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    const begin = () => {
      if (activeRef.current) return;
      activeRef.current = true;
      clearTimers();
      setActive(true);
      setWidth(12);
      timers.current.push(setTimeout(() => setWidth(56), 90));
      timers.current.push(setTimeout(() => setWidth(82), 560));
      timers.current.push(setTimeout(() => setWidth(92), 2_000));
      // Navegação que falhou não deixa barra presa indefinidamente.
      timers.current.push(setTimeout(() => {
        activeRef.current = false;
        setActive(false);
        setWidth(0);
      }, 15_000));
    };
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) begin();
    };
    const onBack = () => begin();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onBack);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onBack);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (initial.current) { initial.current = false; return; }
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();
    setWidth(100);
    timers.current.push(setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 230));
  }, [pathname, search?.toString()]);

  if (!active && width === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] bg-transparent">
      <div data-lexis-nav-progress className="h-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: width + "%" }} />
    </div>
  );
}

export function NavProgress() {
  return <Suspense fallback={null}><NavProgressInner /></Suspense>;
}
