/**
 * Chrome client-only. Scanner sob demanda (não no boot).
 */
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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

const AppUpdateBanner = dynamic(
  () =>
    import("@/components/system/app-update-banner").then((m) => m.AppUpdateBanner),
  { ssr: false }
);

const PacmanTrollOverlay = dynamic(
  () =>
    import("@/components/troll/pacman-troll-overlay").then((m) => m.PacmanTrollOverlay),
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

const AgentDock = dynamic(
  () => import("@/components/agents/agent-dock").then((m) => m.AgentDock),
  { ssr: false }
);

const LaunchAnnounceModal = dynamic(
  () =>
    import("@/components/system/launch-announce-modal").then(
      (m) => m.LaunchAnnounceModal
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

const DesktopDownloadBanner = dynamic(
  () =>
    import("@/components/system/desktop-download-banner").then(
      (m) => m.DesktopDownloadBanner
    ),
  { ssr: false }
);

export function ClientChrome() {
  const [scannerReady, setScannerReady] = useState(false);
  const [tourReady, setTourReady] = useState(false);

  useEffect(() => {
    const enableScanner = () => setScannerReady(true);
    window.addEventListener("lexis-need-scanner", enableScanner);

    const idle =
      "requestIdleCallback" in window
        ? (window as any).requestIdleCallback(
            () => {
              setTourReady(true);
              setScannerReady(true);
            },
            { timeout: 8000 }
          )
        : null;
    const fallback = window.setTimeout(() => {
      setTourReady(true);
      setScannerReady(true);
    }, 5000);

    return () => {
      window.removeEventListener("lexis-need-scanner", enableScanner);
      window.clearTimeout(fallback);
      if (idle != null && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idle);
      }
    };
  }, []);

  return (
    <>
      <NavProgress />
      <UiPrefsApplier />
      {tourReady ? <GuidedTour /> : null}
      {scannerReady ? <DataJudScannerPanel /> : null}
      <AgentDock />
      <LaunchAnnounceModal />
      <AppUpdateBanner />
      <DesktopDownloadBanner />
      <PacmanTrollOverlay />
      <LexisCommandPalette />
      <ChatNotifPermission />
      <HybridAutoSync />
      <ChatRealtimeNotify />
    </>
  );
}
