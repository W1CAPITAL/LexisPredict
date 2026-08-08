import { Loader2 } from "lucide-react";

/**
 * Placeholder de carregamento de rota (Next.js loading.tsx).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
export default function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
      </div>
    </div>
  );
}
