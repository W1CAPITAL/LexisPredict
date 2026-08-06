"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function TextureCardStyled({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "texture-card relative overflow-hidden rounded-[20px] border border-neutral-200/80 dark:border-neutral-800",
        "bg-stone-50/90 dark:bg-neutral-950/90 shadow-[0_12px_40px_rgba(0,0,0,0.08)]",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-[0.35]",
        "before:bg-[url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")]",
        className
      )}
      {...props}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export function TextureCardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function TextureCardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function TextureCardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

export function TextureCardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

export function TextureSeparator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-px w-full bg-gradient-to-r from-transparent via-neutral-300 dark:via-neutral-700 to-transparent",
        className
      )}
    />
  );
}
