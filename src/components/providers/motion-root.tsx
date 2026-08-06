"use client";

import { MotionProvider } from "@/components/ui/motion";

/** Envolve o app no layout para animações com LazyMotion */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}
