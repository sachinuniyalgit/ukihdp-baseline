import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SyncOnReconnect } from "@/components/sync-on-reconnect";
import "./globals.css";

export const metadata: Metadata = {
  title: "UKIHDP Baseline Assessment",
  description: "Field data collection, review, monitoring, and analysis platform.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><PwaRegister /><SyncOnReconnect />{children}</AuthProvider></body></html>;
}
