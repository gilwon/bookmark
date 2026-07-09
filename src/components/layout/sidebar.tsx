// 앱 사이드바 — 네비게이션, 프로필, 테마 토글, 로그아웃
"use client";

import {
  Bookmark,
  ExternalLink,
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
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
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
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

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
                ? "bg-indigo-600/20 text-indigo-600 dark:text-indigo-300"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footerProps = {
    theme,
    toggleTheme,
    name: session?.user?.name,
    email: session?.user?.email,
    image: session?.user?.image,
    githubLogin: session?.githubLogin,
    hasGithub: Boolean(session?.hasGithub),
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 lg:hidden">
        <Link href="/bookmarks" className="text-lg font-bold text-foreground">
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

      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-64 flex-col border-r border-border bg-sidebar py-4">
            <div className="mb-4 px-5 text-lg font-bold text-foreground">
              MyMark
            </div>
            {Nav}
            <SidebarFooter {...footerProps} />
          </aside>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar py-5 lg:flex">
        <Link
          href="/bookmarks"
          className="mb-6 px-5 text-xl font-bold tracking-tight text-foreground"
        >
          MyMark
        </Link>
        {Nav}
        <SidebarFooter {...footerProps} />
      </aside>
    </>
  );
}

/** 사이드바 하단 — 프로필·테마·로그아웃 */
function SidebarFooter({
  theme,
  toggleTheme,
  name,
  email,
  image,
  githubLogin,
  hasGithub,
}: {
  theme: "dark" | "light";
  toggleTheme: () => void;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  githubLogin?: string | null;
  hasGithub?: boolean;
}) {
  const profileHref = githubLogin
    ? `https://github.com/${githubLogin}`
    : null;

  return (
    <div className="mt-auto space-y-2 border-t border-border px-3 pt-3">
      <div className="flex items-center gap-3 px-2 py-1">
        {image ? (
          <Image
            src={image}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-full border border-border object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {(name ?? email ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {name ?? "사용자"}
          </p>
          {githubLogin ? (
            <a
              href={profileHref!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-indigo-500"
            >
              @{githubLogin}
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              {email ?? (hasGithub ? "GitHub 연동" : "로컬 계정")}
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="w-full justify-start"
        onClick={toggleTheme}
        aria-label={
          theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"
        }
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
        className="w-full justify-start text-muted-foreground"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-4 w-4" />
        로그아웃
      </Button>
    </div>
  );
}
