// 루트 레이아웃 — Pretendard, Providers, 테마 초기화
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyMark — Personal Bookmark Hub",
  description: "북마크 · GitHub Stars · 커스텀 페이지를 한곳에서 관리",
  applicationName: "MyMark",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MyMark",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

/**
 * FOUC 방지용 인라인 스크립트.
 * next/script(beforeInteractive)는 React 19에서 클라이언트 script 경고를 내므로
 * Server Component head 의 네이티브 <script> 로 주입한다.
 */
const themeInitScript =
  "(function(){try{var t=localStorage.getItem('theme');var r=document.documentElement;r.classList.remove('light','dark');if(t==='dark'){r.classList.add('dark');r.style.colorScheme='dark';}else{r.classList.add('light');r.style.colorScheme='light';}}catch(e){document.documentElement.classList.add('light');}})();";

/** 앱 루트 HTML 셸 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#f5f5f7" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
