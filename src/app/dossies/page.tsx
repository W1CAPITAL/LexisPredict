import { Sidebar } from "@/components/layout/sidebar";
import { DossieChatStudio } from "@/components/dossies/dossie-chat-studio";

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
