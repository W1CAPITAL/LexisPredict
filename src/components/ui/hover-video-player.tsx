"use client";

import React, { useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function HoverVideoPlayer({
  videoSrc,
  poster,
  className,
  title = "Treinamento",
}: {
  videoSrc: string;
  poster?: string;
  className?: string;
  title?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border-2 border-black bg-black shadow-[8px_8px_0_#00D1FF]",
        className
      )}
      onMouseEnter={() => {
        const v = ref.current;
        if (v && !playing) {
          v.muted = true;
          v.play().catch(() => {});
        }
      }}
      onMouseLeave={() => {
        const v = ref.current;
        if (v && !playing) {
          v.pause();
          v.currentTime = 0;
        }
      }}
    >
      <video
        ref={ref}
        src={videoSrc}
        poster={poster}
        className="w-full aspect-video object-contain bg-black"
        controls={playing}
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          /* keep state if user paused via controls */
        }}
      />
      {!playing ? (
        <button
          type="button"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 text-white"
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            v.muted = false;
            v.controls = true;
            v.play().catch(() => {});
            setPlaying(true);
          }}
        >
          <span className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Play size={22} className="ml-1" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            {title} · clique ou passe o mouse
          </span>
        </button>
      ) : null}
    </div>
  );
}
