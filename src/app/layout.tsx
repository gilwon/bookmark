// 루트 레이아웃 — 폰트, Providers, 테마 초기화
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyMark — Personal Bookmark Hub",
  description: "북마크 · GitHub Stars · 커스텀 페이지를 한곳에서 관리",
};

/**
 * FOUC 방지용 인라인 스크립트.
 * next/script(beforeInteractive)는 React 19에서 클라이언트 script 경고를 내므로
 * Server Component head 의 네이티브 <script> 로 주입한다.
 */
const themeInitScript =
  "(function(){try{var t=localStorage.getItem('theme');var r=document.documentElement;r.classList.remove('light','dark');if(t==='light'){r.classList.add('light');r.style.colorScheme='light';}else{r.classList.add('dark');r.style.colorScheme='dark';}}catch(e){document.documentElement.classList.add('dark');}})();";

/** 앱 루트 HTML 셸 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- 테마 FOUC 방지, React 19 next/script 경고 회피 */}
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
