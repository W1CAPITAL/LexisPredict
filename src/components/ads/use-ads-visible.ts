"use client";

import { useEffect, useState } from "react";
import { ADS_ENABLED } from "@/lib/adsterra";
import { adsVisibleForSessionAction } from "@/app/actions/ads-visible-action";

export function useAdsVisible() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(!ADS_ENABLED);

  useEffect(() => {
    if (!ADS_ENABLED) {
      setVisible(false);
      setReady(true);
      return;
    }
    let live = true;
    adsVisibleForSessionAction()
      .then((v) => {
        if (live) setVisible(!!v);
      })
      .catch(() => {
        if (live) setVisible(false);
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return { visible: ADS_ENABLED && visible, ready };
}
