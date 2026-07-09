// 루트 레이아웃 — 폰트, Providers, 다크 기본
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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

/** FOUC 방지: 페인트 전에 localStorage 테마를 적용한다 (클라이언트 컴포넌트 script 금지). */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var r=document.documentElement;r.classList.remove('light','dark');if(t==='light'){r.classList.add('light');r.style.colorScheme='light';}else{r.classList.add('dark');r.style.colorScheme='dark';}}catch(e){document.documentElement.classList.add('dark');}})();`;

/** 앱 루트 HTML 셸 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
