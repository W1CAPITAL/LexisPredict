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

export function ClientChrome() {
  const [scannerReady, setScannerReady] = useState(false);
  const [tourReady, setTourReady] = useState(false);

  useEffect(() => {
    const enableScanner = () => setScannerReady(true);
    window.addEventListener("lexis-need-scanner", enableScanner);

    // Boot leve: tour e scanner só depois do idle
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
      {tourReady ? <GuidedTour /> : null}
      {scannerReady ? <DataJudScannerPanel /> : null}
      <AppUpdateBanner />
      <PacmanTrollOverlay />
    </>
  );
}
