import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SyncOnReconnect } from "@/components/sync-on-reconnect";
import { GlobalConnectivity } from "@/components/global-connectivity";
import "./globals.css";
import "./connectivity.css";

export const metadata: Metadata = {
  title: "FieldFlow · Field Data & Assessment Platform",
  description: "Reusable offline field data collection, review, GIS, monitoring, and assessment platform.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><PwaRegister /><SyncOnReconnect /><GlobalConnectivity />{children}</AuthProvider></body></html>;
}
