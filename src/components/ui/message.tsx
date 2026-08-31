"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Message({
  align = "start",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }) {
  return (
    <div
      className={cn(
        "flex w-full gap-2",
        align === "end" ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    />
  );
}

export function MessageAvatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0", className)} {...props} />;
}

export function MessageContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 max-w-[80%] flex-col", className)} {...props} />;
}

export function MessageHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-[11px] font-semibold text-muted-foreground", className)} {...props} />;
}

export function MessageFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-[10px] text-muted-foreground", className)} {...props} />;
}
