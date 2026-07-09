// 앱 사이드바 — 네비게이션, 테마 토글, 로그아웃
"use client";

import {
  Bookmark,
  FileText,
  GitFork,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/bookmarks", label: "북마크", icon: Bookmark },
  { href: "/stars", label: "GitHub Stars", icon: GitFork },
  { href: "/pages", label: "페이지", icon: FileText },
  { href: "/search", label: "검색", icon: Search },
];

/** 사이드바 본문 (데스크톱 고정 + 모바일 드로어) */
export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  /** 네비 링크 목록 */
  const Nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* 모바일 상단 바 */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 lg:hidden">
        <Link href="/bookmarks" className="text-lg font-bold text-zinc-50">
          MyMark
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen((v) => !v)}
          aria-label="메뉴"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* 모바일 오버레이 메뉴 */}
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-950 py-4">
            <div className="mb-4 px-5 text-lg font-bold text-zinc-50">MyMark</div>
            {Nav}
            <SidebarFooter
              theme={theme}
              setTheme={setTheme}
              email={session?.user?.email}
            />
          </aside>
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 py-5 lg:flex">
        <Link
          href="/bookmarks"
          className="mb-6 px-5 text-xl font-bold tracking-tight text-zinc-50"
        >
          MyMark
        </Link>
        {Nav}
        <SidebarFooter
          theme={theme}
          setTheme={setTheme}
          email={session?.user?.email}
        />
      </aside>
    </>
  );
}

/** 사이드바 하단 — 유저 정보, 테마, 로그아웃 */
function SidebarFooter({
  theme,
  setTheme,
  email,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  email?: string | null;
}) {
  return (
    <div className="mt-auto space-y-2 border-t border-zinc-800 px-3 pt-3">
      {email && (
        <p className="truncate px-3 text-xs text-zinc-500">{email}</p>
      )}
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        {theme === "dark" ? "라이트 모드" : "다크 모드"}
      </Button>
      <Button
        variant="ghost"
        className="w-full justify-start text-zinc-400"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-4 w-4" />
        로그아웃
      </Button>
    </div>
  );
}
