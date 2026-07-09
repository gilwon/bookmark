// SessionProvider + ThemeProvider + PWA 묶음
"use client";

import { SessionProvider } from "next-auth/react";
import { PwaInstallToast } from "@/components/pwa/pwa-install-toast";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";

/** 클라이언트 전역 프로바이더 조합 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <PwaRegister />
        <PwaInstallToast />
      </ThemeProvider>
    </SessionProvider>
  );
}
