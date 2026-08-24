/**
 * Chrome client-only. Scanner sob demanda (não no boot).
 */
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

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
        ? (window as any).requestIdleCallback(() => {
            setTourReady(true);
            setScannerReady(true);
          }, { timeout: 8000 })
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
      <UiPrefsApplier />
      {tourReady ? <GuidedTour /> : null}
      {scannerReady ? <DataJudScannerPanel /> : null}
      <AppUpdateBanner />
      <DesktopDownloadBanner />
      <PacmanTrollOverlay />
      <LexisCommandPalette />
    </>
  );
}
