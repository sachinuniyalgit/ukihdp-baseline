"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    const developmentPreview = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_PWA_DEV === "true";
    if ((process.env.NODE_ENV !== "production" && !developmentPreview) || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
