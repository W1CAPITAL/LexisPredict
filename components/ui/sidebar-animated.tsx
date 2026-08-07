"use client";

/**
 * Sidebar animado (estilo Aceternity) — sem framer-motion.
 * Primitivos reutilizáveis; o menu real do Lexis fica em layout/sidebar.tsx.
 */
import React, { createContext, useContext } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type SidebarContextProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export function useSidebarAnimated() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebarAnimated must be used within SidebarAnimated");
  return ctx;
}

export function SidebarAnimated({
  open,
  setOpen,
  children,
  className,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <div
        className={cn(
          "flex flex-col h-full bg-sidebar/95 backdrop-blur-md border-r border-sidebar-border transition-[width] duration-300 ease-out overflow-hidden",
          open ? "w-[280px]" : "w-[72px]",
          className
        )}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function SidebarBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col flex-1 min-h-0 justify-between gap-4", className)}>
      {children}
    </div>
  );
}

export function SidebarLink({
  link,
  className,
  active,
}: {
  link: {
    label: string;
    href: string;
    icon: React.ReactNode;
  };
  className?: string;
  active?: boolean;
}) {
  const { open } = useSidebarAnimated();
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 group/sidebar py-2.5 px-3 rounded-lg transition-all duration-200",
        active
          ? "bg-primary/10 text-primary font-semibold shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className
      )}
      title={!open ? link.label : undefined}
    >
      <span className="h-5 w-5 shrink-0 flex items-center justify-center">{link.icon}</span>
      <span
        className={cn(
          "text-[11px] font-bold tracking-tight uppercase whitespace-pre transition-all duration-200 overflow-hidden",
          open ? "opacity-100 w-auto" : "opacity-0 w-0"
        )}
      >
        {link.label}
      </span>
    </Link>
  );
}

export function SidebarLogo({
  open,
  title = "LexisPredict",
  subtitle = "Operações",
  icon,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link href="/" className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20 min-w-0">
      <div className="h-9 w-9 bg-primary text-primary-foreground rounded-xl flex-shrink-0 flex items-center justify-center shadow-md">
        {icon}
      </div>
      <span
        className={cn(
          "font-bold text-[13px] text-sidebar-foreground whitespace-pre transition-opacity duration-200 truncate",
          open ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
        )}
      >
        {title}
        {subtitle ? (
          <span className="block text-[10px] text-primary font-semibold mt-0.5">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
