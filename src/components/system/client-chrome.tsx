/**
 * Chrome client-only.
 *
 * Regra de desempenho:
 * - nada pesado entra no caminho crítico da navegação;
 * - Scanner e Agentes só montam quando o usuário pede;
 * - serviços auxiliares entram depois que a tela já está utilizável.
 */
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { NavProgress } from "@/components/system/nav-progress";

const GuidedTour = dynamic(
  () => import("@/components/onboarding/guided-tour").then((m) => m.GuidedTour),
  { ssr: false }
);

const DataJudScannerPanel = dynamic(
  () =>
    import("@/components/scanner/datajud-scanner-panel").then(
      (m) => m.DataJudScannerPanel
    ),
  { ssr: false }
);

const AgentDock = dynamic(
  () => import("@/components/agents/agent-dock").then((m) => m.AgentDock),
  { ssr: false }
);

const AppUpdateBanner = dynamic(
  () =>
    import("@/components/system/app-update-banner").then((m) => m.AppUpdateBanner),
  { ssr: false }
);

const UiPrefsApplier = dynamic(
  () => import("@/components/system/ui-prefs-applier").then((m) => m.UiPrefsApplier),
  { ssr: false }
);

const LexisCommandPalette = dynamic(
  () =>
    import("@/components/sf-chrome/lexis-command-palette").then(
      (m) => m.LexisCommandPalette
    ),
  { ssr: false }
);

const ChatRealtimeNotify = dynamic(
  () =>
    import("@/components/system/chat-realtime-notify").then(
      (m) => m.ChatRealtimeNotify
    ),
  { ssr: false }
);

const HybridSyncBadge = dynamic(
  () =>
    import("@/components/hybrid/hybrid-sync-badge").then((m) => m.HybridSyncBadge),
  { ssr: false }
);

const HybridAutoSync = dynamic(
  () =>
    import("@/components/hybrid/hybrid-auto-sync").then((m) => m.HybridAutoSync),
  { ssr: false }
);

const ChatNotifPermission = dynamic(
  () =>
    import("@/components/system/chat-notif-permission").then(
      (m) => m.ChatNotifPermission
    ),
  { ssr: false }
);

export function ClientChrome() {
  const pathname = usePathname();
  const [scannerReady, setScannerReady] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [tourReady, setTourReady] = useState(false);
  const [deferredReady, setDeferredReady] = useState(false);
  const [desktopExtras, setDesktopExtras] = useState(false);

  useEffect(() => {
    const enableScanner = () => setScannerReady(true);
    const enableAgents = () => setAgentReady(true);
    const enableTour = () => setTourReady(true);

    window.addEventListener("lexis-need-scanner", enableScanner);
    window.addEventListener("lexis-open-agents", enableAgents);
    window.addEventListener("lexis-need-tour", enableTour);

    // O guia pode ser iniciado pela página /onboarding.
    if (pathname === "/onboarding") setTourReady(true);

    // Pré-carrega somente serviços leves depois que a tela já respondeu ao usuário.
    const idleCallback =
      "requestIdleCallback" in window
        ? (window as any).requestIdleCallback(
            () => setDeferredReady(true),
            { timeout: 9000 }
          )
        : null;

    const fallback = window.setTimeout(() => setDeferredReady(true), 7000);

    // Recursos exclusivamente de desktop não entram no bundle crítico do celular.
    const media = window.matchMedia("(min-width: 768px)");
    const syncDesktop = () => setDesktopExtras(media.matches);
    syncDesktop();
    media.addEventListener?.("change", syncDesktop);

    return () => {
      window.removeEventListener("lexis-need-scanner", enableScanner);
      window.removeEventListener("lexis-open-agents", enableAgents);
      window.removeEventListener("lexis-need-tour", enableTour);
      window.clearTimeout(fallback);
      if (idleCallback != null && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleCallback);
      }
      media.removeEventListener?.("change", syncDesktop);
    };
  }, [pathname]);

  return (
    <>
      <NavProgress />
      <UiPrefsApplier />

      {tourReady ? <GuidedTour /> : null}
      {scannerReady ? <DataJudScannerPanel /> : null}
      {agentReady ? <AgentDock /> : null}

      {deferredReady ? (
        <>
          <AppUpdateBanner />
          {(pathname.startsWith("/chat") || pathname.startsWith("/whatsapp")) ? (
            <>
              <ChatNotifPermission />
              <ChatRealtimeNotify />
            </>
          ) : null}
          {desktopExtras ? <LexisCommandPalette /> : null}
        </>
      ) : null}
    </>
  );
}
