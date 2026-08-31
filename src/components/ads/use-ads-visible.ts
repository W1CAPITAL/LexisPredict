"use client";

import { useEffect, useState } from "react";
import { adsVisibleForSessionAction } from "@/app/actions/ads-visible-action";

export function useAdsVisible() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    adsVisibleForSessionAction()
      .then((v) => {
        if (live) setVisible(!!v);
      })
      .catch(() => {
        if (live) setVisible(true);
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return { visible, ready };
}
