import { LexisThinkingOrb } from "@/components/ui/lexis-thinking-orb";

export default function PageLoader({ label = "Abrindo…" }: { label?: string }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[240]"
    >
      <div className="h-[3px] overflow-hidden bg-primary/10">
        <div className="h-full w-1/3 animate-[lexis-route-load_1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 text-[11px] font-bold text-muted-foreground shadow-md backdrop-blur">
        <LexisThinkingOrb state="connecting" size={20} />
        {label}
      </div>
      <style>{`
        @keyframes lexis-route-load {
          0% { transform: translateX(-120%); }
          55% { transform: translateX(160%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
