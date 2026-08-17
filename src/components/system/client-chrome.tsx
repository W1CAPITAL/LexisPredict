/**
 * Chrome client-only (tour, scanner, banner de update + troll Pac-Man).
 */
"use client";

import dynamic from "next/dynamic";

const GuidedTour = dynamic(
  () =>
    import("@/components/onboarding/guided-tour").then((m) => m.GuidedTour),
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
    import("@/components/system/app-update-banner").then(
      (m) => m.AppUpdateBanner
    ),
  { ssr: false }
);

const PacmanTrollOverlay = dynamic(
  () =>
    import("@/components/troll/pacman-troll-overlay").then(
      (m) => m.PacmanTrollOverlay
    ),
  { ssr: false }
);

export function ClientChrome() {
  return (
    <>
      <GuidedTour />
      <DataJudScannerPanel />
      <AppUpdateBanner />
      <PacmanTrollOverlay />
    </>
  );
}
