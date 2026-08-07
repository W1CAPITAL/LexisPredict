"use client";

import React, { useEffect, useState } from "react";

export function Typewriter({
  texts,
  baseText = "",
  delay = 2,
  className,
}: {
  texts: string[];
  baseText?: string;
  delay?: number;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [sub, setSub] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);

  useEffect(() => {
    const current = texts[idx] || "";
    const t = setTimeout(
      () => {
        if (dir === 1) {
          if (sub >= current.length) {
            setDir(-1);
          } else setSub((s) => s + 1);
        } else {
          if (sub <= 0) {
            setDir(1);
            setIdx((i) => (i + 1) % texts.length);
          } else setSub((s) => s - 1);
        }
      },
      dir === 1 ? 40 * delay : 25 * delay
    );
    return () => clearTimeout(t);
  }, [sub, dir, idx, texts, delay]);

  const shown = (texts[idx] || "").slice(0, sub);
  return (
    <span className={className}>
      {baseText}
      {shown}
      <span className="animate-pulse">|</span>
    </span>
  );
}
