"use client";
import { MotionProvider } from "@/components/ui/motion";
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}
