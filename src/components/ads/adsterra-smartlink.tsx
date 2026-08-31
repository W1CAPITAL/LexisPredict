"use client";

import React from "react";
import { ADSTERRA } from "@/lib/adsterra";
import { useAdsVisible } from "@/components/ads/use-ads-visible";

export function AdsterraSmartlink({ className }: { className?: string }) {
  const { visible } = useAdsVisible();
  if (!visible) return null;
  return (
    <a
      href={ADSTERRA.smartlink}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={
        className ||
        "text-[10px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
      }
    >
      Ofertas parceiras
    </a>
  );
}
