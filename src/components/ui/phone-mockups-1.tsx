"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
export type ImageItem = { src: string; alt: string };
const DEFAULT: ImageItem[] = [
  { src: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=800&fit=crop", alt: "Lexis mobile" },
  { src: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&h=800&fit=crop", alt: "Dashboard" },
];
export function PhoneCarousel({ images = DEFAULT, className }: { images?: ImageItem[]; className?: string }) {
  const [i, setI] = useState(0);
  const img = images[i % images.length];
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="w-[200px] rounded-[1.75rem] border-[8px] border-foreground overflow-hidden aspect-[9/19] shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={img.alt} className="h-full w-full object-cover" />
      </div>
      <div className="flex gap-2">
        <button type="button" className="h-8 w-8 rounded-full border" onClick={() => setI((v) => (v - 1 + images.length) % images.length)}><ChevronLeft size={14} className="mx-auto" /></button>
        <button type="button" className="h-8 w-8 rounded-full border" onClick={() => setI((v) => (v + 1) % images.length)}><ChevronRight size={14} className="mx-auto" /></button>
      </div>
    </div>
  );
}
export default function PhoneMockupBasic() { return <PhoneCarousel />; }
