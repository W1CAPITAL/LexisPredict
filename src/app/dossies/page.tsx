import { Sidebar } from "@/components/layout/sidebar";
import { DossieChatStudio } from "@/components/dossies/dossie-chat-studio";

// Consultas judiciais e organização documental podem ultrapassar o timeout
// implícito de 10s dos demais endpoints serverless.
export const maxDuration = 60;

export default function DossiesPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f8fc] text-foreground">
      <Sidebar />
      <main className="lexis-main-pad flex min-w-0 flex-1 flex-col overflow-hidden">
        <DossieChatStudio />
      </main>
    </div>
  );
}
